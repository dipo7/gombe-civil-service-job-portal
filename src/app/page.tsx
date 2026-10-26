import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PORTAL_NAME, PORTAL_TAGLINE } from "@/lib/brand";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ department?: string }> }) {
  const { department } = await searchParams;
  const now = new Date();
  const open = { isOpen: true, OR: [{ closesAt: null }, { closesAt: { gt: now } }] };

  const [departments, jobs] = await Promise.all([
    prisma.job.findMany({ where: open, select: { department: true }, distinct: ["department"], orderBy: { department: "asc" } }),
    prisma.job.findMany({
      where: { ...open, ...(department ? { department } : {}) },
      select: { id: true, title: true, department: true, location: true, closesAt: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const pill = (active: boolean) =>
    cn(
      "rounded-full border px-3 py-1 text-sm transition-colors",
      active ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-secondary",
    );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border-l-8 border-accent bg-primary px-6 py-8 text-primary-foreground shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent">{PORTAL_TAGLINE}</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">{PORTAL_NAME}</h1>
        <p className="mt-2 max-w-2xl text-sm opacity-90">
          Serve Gombe State. Browse current vacancies in the State Civil Service and apply online. Every application is
          screened against the published requirements.
        </p>
      </section>

      <h2 className="text-xl font-semibold">Open positions</h2>

      <nav aria-label="Filter by department" className="flex flex-wrap gap-2">
        <Link href="/" className={pill(!department)}>
          All departments
        </Link>
        {departments.map((d) => (
          <Link key={d.department} href={`/?department=${encodeURIComponent(d.department)}`} className={pill(department === d.department)}>
            {d.department}
          </Link>
        ))}
      </nav>

      {jobs.length === 0 ? (
        <p className="rounded-lg border bg-card p-8 text-center text-muted-foreground">No open positions found.</p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <li key={job.id}>
              <Link href={`/jobs/${job.id}`} className="block h-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg">
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <Badge className="w-fit">{job.department}</Badge>
                    <CardTitle>{job.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-muted-foreground">
                    <p>{job.location}</p>
                    {job.closesAt && <p>Closes {job.closesAt.toLocaleDateString("en-NG", { dateStyle: "long" })}</p>}
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
