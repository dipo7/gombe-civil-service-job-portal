import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireAdmin();
  const page = Math.max(1, Number.parseInt((await searchParams).page ?? "1", 10) || 1);

  const [total, entries] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
      <p className="text-sm text-muted-foreground">Who viewed, downloaded, or changed what. Entries cannot be edited from the portal.</p>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b bg-muted/60 uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Admin</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
              <th className="px-4 py-3">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((e) => (
              <tr key={e.id} className="align-top">
                <td className="whitespace-nowrap px-4 py-2">{e.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "medium" })}</td>
                <td className="px-4 py-2">{e.adminEmail}</td>
                <td className="px-4 py-2 font-medium">{e.action}</td>
                <td className="px-4 py-2 text-muted-foreground">
                  {e.entityType && e.entityId ? (
                    e.entityType === "Application" ? (
                      <Link href={`/admin/applicants/${e.entityId}`} className="underline">
                        {e.entityType}
                      </Link>
                    ) : (
                      e.entityType
                    )
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-2 text-muted-foreground">{e.details ?? ""}</td>
                <td className="px-4 py-2 text-muted-foreground">{e.ip ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {pages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/audit?page=${page - 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Newer
              </Link>
            )}
            {page < pages && (
              <Link href={`/admin/audit?page=${page + 1}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                Older
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
