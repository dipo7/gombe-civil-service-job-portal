"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession, getAdmin, requireAdmin } from "@/lib/auth";
import { audit, requestIp } from "@/lib/audit";
import { recordAudit } from "@/lib/audit-core";
import { readJobForm, type JobFormData } from "@/lib/admin-validation";
import { jobIdSchema } from "@/lib/validation";

export type FormState = { ok?: boolean; message?: string; errors?: Record<string, string> };

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
});

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await requestIp();
  if (!(await rateLimit(`admin-login:${ip}`, 10, 900))) {
    return { message: "Too many attempts. Try again in 15 minutes." };
  }

  const parsed = loginSchema.safeParse({ email: formData.get("email"), password: formData.get("password") });
  const invalid = { message: "Invalid email or password." };
  if (!parsed.success) return invalid;

  const admin = await prisma.adminUser.findUnique({ where: { email: parsed.data.email } });
  const ok = await verifyPassword(parsed.data.password, admin?.passwordHash ?? DUMMY_HASH);
  if (!admin || !ok) {
    await recordAudit({ adminEmail: parsed.data.email, action: "login.failed", ip: await requestIp() });
    return invalid;
  }

  await createSession(admin.id);
  await audit(admin, "login.success");
  redirect("/admin");
}

export async function logout(): Promise<void> {
  const admin = await getAdmin();
  if (admin) await audit(admin, "logout");
  await destroySession();
  redirect("/admin/login");
}

function jobData(d: JobFormData) {
  return {
    title: d.title,
    department: d.department,
    location: d.location,
    description: d.description,
    responsibilities: d.responsibilities,
    requirements: d.requirements,
    hrEmail: d.hrEmail,
    closesAt: d.closesAt,
    isOpen: d.isOpen,
    minAge: d.minAge,
    maxAge: d.maxAge,
    requireGombeOrigin: d.requireGombeOrigin,
    allowedLgas: d.requireGombeOrigin ? d.allowedLgas : [],
  };
}

function toErrors(error: z.ZodError): FormState {
  const errors: Record<string, string> = {};
  for (const i of error.issues) errors[String(i.path[0] ?? "form")] ??= i.message;
  return { message: "Please correct the highlighted fields.", errors };
}

function revalidatePublic(jobId?: string) {
  revalidatePath("/");
  revalidatePath("/admin");
  if (jobId) revalidatePath(`/jobs/${jobId}`);
}

export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = readJobForm(formData);
  if (!parsed.success) return toErrors(parsed.error);

  const job = await prisma.job.create({
    data: {
      ...jobData(parsed.data),
      createdById: admin.id,
      degreeRules: { create: parsed.data.degreeRules.map((r) => ({ type: r.type, minClass: r.minClass as never })) },
    },
    select: { id: true },
  });
  await audit(admin, "job.create", { type: "Job", id: job.id }, parsed.data.title);
  revalidatePublic(job.id);
  redirect("/admin");
}

export async function updateJob(jobId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  if (!jobIdSchema.safeParse(jobId).success) return { message: "Job not found." };
  const parsed = readJobForm(formData);
  if (!parsed.success) return toErrors(parsed.error);

  try {
    await prisma.$transaction([
      prisma.jobDegreeRule.deleteMany({ where: { jobId } }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          ...jobData(parsed.data),
          degreeRules: { create: parsed.data.degreeRules.map((r) => ({ type: r.type, minClass: r.minClass as never })) },
        },
      }),
    ]);
  } catch {
    return { message: "Job not found or could not be saved." };
  }
  await audit(admin, "job.update", { type: "Job", id: jobId }, parsed.data.title);
  revalidatePublic(jobId);
  redirect("/admin");
}

export async function toggleJobOpen(jobId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!jobIdSchema.safeParse(jobId).success) return;
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { isOpen: true } });
  if (!job) return;
  await prisma.job.update({ where: { id: jobId }, data: { isOpen: !job.isOpen } });
  await audit(admin, job.isOpen ? "job.close" : "job.reopen", { type: "Job", id: jobId });
  revalidatePublic(jobId);
}

/** Jobs with applications cannot be deleted; close them instead. */
export async function deleteJob(jobId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!jobIdSchema.safeParse(jobId).success) return;
  const count = await prisma.application.count({ where: { jobId } });
  if (count > 0) return;
  await prisma.job.delete({ where: { id: jobId } }).catch(() => undefined);
  await audit(admin, "job.delete", { type: "Job", id: jobId });
  revalidatePublic(jobId);
}

const newAdminSchema = z
  .object({
    name: z.string().trim().min(2, "Enter a name").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email").max(254),
    password: z.string().min(12, "Password must be at least 12 characters").max(200),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function createAdmin(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdmin();
  const parsed = newAdminSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) return toErrors(parsed.error);

  const { name, email, password } = parsed.data;
  if (await prisma.adminUser.findUnique({ where: { email }, select: { id: true } })) {
    return { message: "Please correct the highlighted fields.", errors: { email: "An administrator with this email already exists" } };
  }

  await prisma.adminUser.create({ data: { name, email, passwordHash: await hashPassword(password) } });
  await audit(actor, "admin.create", { type: "AdminUser", id: email });
  revalidatePath("/admin/admins");
  return { ok: true, message: `Administrator ${email} added. Share the password with them securely.` };
}

/** An admin cannot remove themselves, and the last remaining admin cannot be removed. */
export async function deleteAdmin(adminId: string): Promise<void> {
  const me = await requireAdmin();
  if (adminId === me.id) return;
  if ((await prisma.adminUser.count()) <= 1) return;
  await prisma.adminUser.delete({ where: { id: adminId } }).catch(() => undefined);
  await audit(me, "admin.delete", { type: "AdminUser", id: adminId });
  revalidatePath("/admin/admins");
}
