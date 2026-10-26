import { notFound } from "next/navigation";
import { updateJob } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jobIdSchema } from "@/lib/validation";
import { JobForm, type JobFormInitial } from "@/components/admin/job-form";

export const dynamic = "force-dynamic";

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) notFound();

  const [job, deps] = await Promise.all([
    prisma.job.findUnique({ where: { id }, include: { degreeRules: true, _count: { select: { applications: true } } } }),
    prisma.job.findMany({ select: { department: true }, distinct: ["department"] }),
  ]);
  if (!job) notFound();

  const initial: JobFormInitial = {
    title: job.title,
    department: job.department,
    location: job.location,
    description: job.description,
    responsibilities: job.responsibilities,
    requirements: job.requirements,
    hrEmail: job.hrEmail,
    closesAt: job.closesAt ? job.closesAt.toISOString().slice(0, 10) : "",
    isOpen: job.isOpen,
    minAge: job.minAge,
    maxAge: job.maxAge,
    requireGombeOrigin: job.requireGombeOrigin,
    allowedLgas: job.allowedLgas,
    degreeRules: job.degreeRules.map((r) => ({ type: r.type, minClass: r.minClass })),
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Edit job</h1>
      {job._count.applications > 0 && (
        <p className="rounded-md border border-accent bg-accent/20 p-3 text-sm">
          This job has {job._count.applications} application(s). Rule changes apply only to future applicants.
        </p>
      )}
      <JobForm action={updateJob.bind(null, job.id)} initial={initial} departments={deps.map((d) => d.department)} submitLabel="Save changes" />
    </div>
  );
}
