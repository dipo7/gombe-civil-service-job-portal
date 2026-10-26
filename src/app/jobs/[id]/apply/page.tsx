import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getPublicJob } from "@/lib/jobs";
import { ApplyForm } from "@/components/apply-form";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage({ params }: Params) {
  const { id } = await params;
  const job = await getPublicJob(id);
  if (!job) notFound();
  if (!job.accepting) redirect(`/jobs/${job.id}`);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/jobs/${job.id}`} className="text-sm text-muted-foreground hover:underline">
        &larr; Back to role
      </Link>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Apply: {job.title}</h1>
        <p className="text-muted-foreground">{job.department}</p>
      </header>
      <ApplyForm jobId={job.id} jobTitle={job.title} requireOriginLetter={job.requireGombeOrigin || job.allowedLgas.length > 0} />
    </div>
  );
}
