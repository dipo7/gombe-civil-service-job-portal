import Link from "next/link";
import { logout } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link href="/admin" className="hover:underline">
            Dashboard
          </Link>
          <Link href="/admin/jobs/new" className="hover:underline">
            New job
          </Link>
          <Link href="/admin/admins" className="hover:underline">
            Admins
          </Link>
          <Link href="/admin/audit" className="hover:underline">
            Audit log
          </Link>
          <Link href="/" className="text-muted-foreground hover:underline">
            View public site
          </Link>
        </nav>
        <form action={logout} className="flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{admin.email}</span>
          <Button type="submit" variant="outline" size="sm">
            Sign out
          </Button>
        </form>
      </div>
      {children}
    </div>
  );
}
