import Link from "next/link";
import { notFound } from "next/navigation";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age";
import { APPLICANT_FILTERS, resolveFilter } from "@/lib/applicant-filters";
import { DEGREE_CLASS_LABELS, DEGREE_TYPE_LABELS } from "@/lib/constants";
import { jobIdSchema } from "@/lib/validation";
import { Badge, Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

export default async function ApplicantsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const { id } = await params;
  if (!jobIdSchema.safeParse(id).success) notFound();

  const sp = await searchParams;
  const filter = resolveFilter(sp.status);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const job = await prisma.job.findUnique({ where: { id }, select: { id: true, title: true, department: true } });
  if (!job) notFound();

  const where = { jobId: id, ...filter.where };
  const [total, applicants, counts] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({ where, orderBy: { submittedAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    Promise.all(APPLICANT_FILTERS.map((f) => prisma.application.count({ where: { jobId: id, ...f.where } }))),
  ]);

  await audit(admin, "applicants.list", { type: "Job", id }, `${filter.key} page ${page}`);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (status: string, p = 1) => `/admin/jobs/${id}/applicants?status=${status}&page=${p}`;
  const now = new Date();

  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-muted-foreground hover:underline">
        &larr; All jobs
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Applicants: {job.title}</h1>
          <p className="text-sm text-muted-foreground">{job.department}</p>
        </div>
        <a href={`/admin/export/${id}?status=${filter.key}`} className={buttonVariants({ variant: "outline" })}>
          Export CSV
        </a>
      </header>

      <nav aria-label="Filter applicants" className="flex flex-wrap gap-2">
        {APPLICANT_FILTERS.map((f, i) => (
          <Link
            key={f.key}
            href={href(f.key)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm",
              f.key === filter.key ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary",
            )}
          >
            {f.label} ({counts[i]})
          </Link>
        ))}
      </nav>

      {applicants.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No applicants in this view.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Applicant</th>
                <th className="px-4 py-3">Origin / Age</th>
                <th className="px-4 py-3">Qualification</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {applicants.map((a) => (
                <tr key={a.id} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/admin/applicants/${a.id}`} className="font-medium hover:underline">
                      {a.fullName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{a.reference}</div>
                    <div className="text-xs text-muted-foreground">{a.email}</div>
                    <div className="text-xs text-muted-foreground">{a.phone}</div>
                    <div className="text-xs text-muted-foreground">{a.submittedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{a.lga ? `${a.stateOfOrigin} (${a.lga})` : a.stateOfOrigin}</div>
                    <div className="text-muted-foreground">{calculateAge(a.dateOfBirth, now)} years</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div className="font-medium">
                      {DEGREE_TYPE_LABELS[a.degreeType].split(" (")[0]} &middot; {DEGREE_CLASS_LABELS[a.degreeClass]}
                    </div>
                    <div>{a.course}</div>
                    <div className="text-muted-foreground">
                      {a.institution}, {a.graduationYear}
                    </div>
                  </td>
                  <td className="space-y-1 px-4 py-3 text-xs">
                    <Badge className={cn(a.status === "Screened_In" && "bg-green-100 text-green-800", a.status === "Screened_Out" && "bg-red-100 text-red-800")}>
                      {a.status.replace("_", " ")}
                      {a.screeningOverriddenBy && " (overridden)"}
                    </Badge>
                    {a.hrDecision !== "Undecided" && (
                      <div>
                        <Badge className={cn(a.hrDecision === "Shortlisted" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>{a.hrDecision}</Badge>
                      </div>
                    )}
                    {a.status === "Screened_In" && (
                      <div className={cn(a.dispatchStatus === "Failed" ? "font-medium text-destructive" : "text-muted-foreground")}>Email: {a.dispatchStatus}</div>
                    )}
                    {a.status === "Screened_Out" && a.screeningNotes.length > 0 && (
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {a.screeningNotes.map((n) => (
                          <li key={n}>{n}</li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/applicants/${a.id}`} className={buttonVariants({ size: "sm" })}>
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={href(filter.key, page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Previous
              </Link>
            )}
            {page < pages && (
              <Link href={href(filter.key, page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
