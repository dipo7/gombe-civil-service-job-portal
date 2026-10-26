"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requeueEmail } from "@/lib/queue";
import { deleteObject } from "@/lib/storage";
import { jobIdSchema } from "@/lib/validation";

const idOk = (id: string) => jobIdSchema.safeParse(id).success;
const textSchema = (max: number) =>
  z
    .string()
    .trim()
    .min(3)
    .max(max)
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ""));

const refresh = (id: string, jobId?: string) => {
  revalidatePath(`/admin/applicants/${id}`);
  if (jobId) revalidatePath(`/admin/jobs/${jobId}/applicants`);
};

export async function setDecision(applicationId: string, decision: "Undecided" | "Shortlisted" | "Rejected"): Promise<void> {
  const admin = await requireAdmin();
  if (!idOk(applicationId) || !["Undecided", "Shortlisted", "Rejected"].includes(decision)) return;

  const app = await prisma.application
    .update({
      where: { id: applicationId },
      data: {
        hrDecision: decision,
        hrDecidedAt: decision === "Undecided" ? null : new Date(),
        hrDecidedByEmail: decision === "Undecided" ? null : admin.email,
      },
      select: { jobId: true },
    })
    .catch(() => null);
  if (!app) return;

  await audit(admin, "applicant.decision", { type: "Application", id: applicationId }, decision);
  refresh(applicationId, app.jobId);
}

export async function addNote(applicationId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const body = textSchema(2000).safeParse(formData.get("body"));
  if (!idOk(applicationId) || !body.success) return;

  await prisma.applicationNote.create({ data: { applicationId, authorEmail: admin.email, body: body.data } }).catch(() => null);
  await audit(admin, "applicant.note", { type: "Application", id: applicationId });
  refresh(applicationId);
}

/** Moves a screened-out applicant into the HR queue after human review. A reason is mandatory. */
export async function overrideScreening(applicationId: string, formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const reason = textSchema(500).safeParse(formData.get("reason"));
  if (!idOk(applicationId) || !reason.success) return;

  const app = await prisma.application.findUnique({ where: { id: applicationId }, select: { status: true, jobId: true } });
  if (!app || app.status !== "Screened_Out") return;

  await prisma.$transaction([
    prisma.application.update({
      where: { id: applicationId },
      data: { status: "Screened_In", screeningOverriddenAt: new Date(), screeningOverriddenBy: admin.email, dispatchStatus: "Queued" },
    }),
    prisma.applicationNote.create({
      data: { applicationId, authorEmail: admin.email, body: `Screening override: ${reason.data}` },
    }),
  ]);
  await requeueEmail("send", applicationId).catch(async (e) => {
    console.error("[admin] override enqueue failed", applicationId, e);
    await prisma.application.update({ where: { id: applicationId }, data: { dispatchStatus: "NotQueued" } });
  });

  await audit(admin, "applicant.override", { type: "Application", id: applicationId }, reason.data);
  refresh(applicationId, app.jobId);
}

export async function retryDispatch(applicationId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!idOk(applicationId)) return;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { status: true, dispatchStatus: true, jobId: true },
  });
  if (!app || app.status !== "Screened_In" || !["Failed", "NotQueued"].includes(app.dispatchStatus)) return;

  await requeueEmail("send", applicationId);
  await prisma.application.update({ where: { id: applicationId }, data: { dispatchStatus: "Queued" } });
  await audit(admin, "applicant.retry_email", { type: "Application", id: applicationId });
  refresh(applicationId, app.jobId);
}

/** Right-to-erasure: removes the application, its files, and its notes. */
export async function deleteApplication(applicationId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!idOk(applicationId)) return;

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { jobId: true, reference: true, resumeKey: true, documents: { select: { key: true } } },
  });
  if (!app) return;

  await Promise.all([app.resumeKey, ...app.documents.map((d) => d.key)].map((k) => deleteObject(k)));
  await prisma.application.delete({ where: { id: applicationId } });
  await audit(admin, "applicant.delete", { type: "Application", id: applicationId }, `reference ${app.reference}`);

  revalidatePath(`/admin/jobs/${app.jobId}/applicants`);
  redirect(`/admin/jobs/${app.jobId}/applicants`);
}
