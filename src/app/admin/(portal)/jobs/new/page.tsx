import { createJob } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EMPTY_JOB, JobForm } from "@/components/admin/job-form";

export const dynamic = "force-dynamic";

export default async function NewJobPage() {
  await requireAdmin();
  const departments = (await prisma.job.findMany({ select: { department: true }, distinct: ["department"] })).map((d) => d.department);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Post a new job</h1>
      <JobForm action={createJob} initial={EMPTY_JOB} departments={departments} submitLabel="Publish job" />
    </div>
  );
}
