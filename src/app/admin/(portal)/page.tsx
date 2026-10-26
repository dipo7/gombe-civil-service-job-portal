import Link from "next/link";
import { deleteJob, toggleJobOpen } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge, Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requireAdmin();

  const [jobs, byStatus, byDispatch] = await Promise.all([
    prisma.job.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.application.groupBy({ by: ["jobId", "status"], _count: { _all: true } }),
    prisma.application.groupBy({ by: ["jobId", "dispatchStatus"], _count: { _all: true } }),
  ]);

  const count = (jobId: string, key: string, rows: { jobId: string; _count: { _all: number } }[], field: "status" | "dispatchStatus") =>
    (rows as unknown as Record<string, unknown>[])
      .filter((r) => r.jobId === jobId && r[field] === key)
      .reduce((n, r) => n + (r._count as { _all: number })._all, 0);

  const now = new Date();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Job listings</h1>
        <Link href="/admin/jobs/new" className={buttonVariants()}>
          Post a new job
        </Link>
      </div>

      {jobs.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">No jobs yet. Post the first vacancy.</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Job</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Applicants</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {jobs.map((job) => {
                const screenedIn = count(job.id, "Screened_In", byStatus, "status");
                const screenedOut = count(job.id, "Screened_Out", byStatus, "status");
                const pending = count(job.id, "Pending", byStatus, "status");
                const total = screenedIn + screenedOut + pending;
                const sent = count(job.id, "Sent", byDispatch, "dispatchStatus");
                const failed = count(job.id, "Failed", byDispatch, "dispatchStatus");
                const expired = !!job.closesAt && job.closesAt < now;
                const live = job.isOpen && !expired;

                return (
                  <tr key={job.id} className="align-top">
                    <td className="px-4 py-3">
                      <Link href={`/jobs/${job.id}`} className="font-medium hover:underline">
                        {job.title}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {job.department} &middot; HR: {job.hrEmail}
                      </div>
                      {job.closesAt && (
                        <div className="text-xs text-muted-foreground">
                          Closes {job.closesAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn(live ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground")}>
                        {live ? "Open" : expired ? "Expired" : "Closed"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="font-medium">{total} total</div>
                      <div className="text-muted-foreground">
                        {screenedIn} in &middot; {screenedOut} out
                      </div>
                      <div className="text-muted-foreground">
                        {sent} emailed{failed > 0 && <span className="font-medium text-destructive"> &middot; {failed} failed</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Link href={`/admin/jobs/${job.id}/applicants`} className={buttonVariants({ size: "sm" })}>
                          Applicants
                        </Link>
                        <Link href={`/admin/jobs/${job.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Edit
                        </Link>
                        <form action={toggleJobOpen.bind(null, job.id)}>
                          <Button type="submit" variant="outline" size="sm">
                            {job.isOpen ? "Close" : "Reopen"}
                          </Button>
                        </form>
                        {total === 0 && (
                          <form action={deleteJob.bind(null, job.id)}>
                            <Button type="submit" variant="outline" size="sm" className="text-destructive">
                              Delete
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
