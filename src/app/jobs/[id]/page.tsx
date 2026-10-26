import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicJob } from "@/lib/jobs";
import { DEGREE_CLASS_LABELS, DEGREE_TYPE_LABELS } from "@/lib/constants";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const job = await getPublicJob((await params).id);
  return { title: job?.title ?? "Position not found" };
}

export default async function JobPage({ params }: Params) {
  const job = await getPublicJob((await params).id);
  if (!job) notFound();

  const criteria: string[] = [];
  if (job.minAge !== null || job.maxAge !== null) {
    criteria.push(
      job.minAge !== null && job.maxAge !== null
        ? `Age between ${job.minAge} and ${job.maxAge} years`
        : job.minAge !== null
          ? `Minimum age: ${job.minAge} years`
          : `Maximum age: ${job.maxAge} years`,
    );
  }
  if (job.requireGombeOrigin) criteria.push("Must be an indigene of Gombe State");
  if (job.allowedLgas.length) criteria.push(`Origin LGA: ${job.allowedLgas.join(", ")}`);
  for (const r of job.degreeRules) {
    criteria.push(`${DEGREE_TYPE_LABELS[r.type]}: minimum ${DEGREE_CLASS_LABELS[r.minClass]}`);
  }

  return (
    <article className="space-y-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; All positions
      </Link>

      <header className="space-y-2">
        <Badge>{job.department}</Badge>
        <h1 className="text-3xl font-bold tracking-tight">{job.title}</h1>
        <p className="text-muted-foreground">
          {job.location}
          {job.closesAt && ` · Closes ${job.closesAt.toLocaleDateString("en-NG", { dateStyle: "long" })}`}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Role description</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-line text-sm leading-relaxed">{job.description}</CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Responsibilities</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {job.responsibilities.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {[...criteria, ...job.requirements].map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {job.accepting ? (
        <Link href={`/jobs/${job.id}/apply`} className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
          Apply for this Role
        </Link>
      ) : (
        <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          This position is no longer accepting applications.
        </p>
      )}
    </article>
  );
}
