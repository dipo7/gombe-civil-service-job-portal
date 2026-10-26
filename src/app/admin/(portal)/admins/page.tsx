import { deleteAdmin } from "@/app/admin/actions";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddAdminForm } from "@/components/admin/add-admin-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

export default async function AdminsPage() {
  const me = await requireAdmin();
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, createdAt: true },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Administrators</h1>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/60 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Added</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {admins.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3 font-medium">
                  {a.name ?? "-"} {a.id === me.id && <span className="text-xs font-normal text-muted-foreground">(you)</span>}
                </td>
                <td className="px-4 py-3">{a.email}</td>
                <td className="px-4 py-3 text-muted-foreground">{a.createdAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}</td>
                <td className="px-4 py-3 text-right">
                  {a.id !== me.id && admins.length > 1 && (
                    <form action={deleteAdmin.bind(null, a.id)}>
                      <Button type="submit" variant="outline" size="sm" className="text-destructive">
                        Remove
                      </Button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add an administrator</CardTitle>
        </CardHeader>
        <CardContent>
          <AddAdminForm />
        </CardContent>
      </Card>
    </div>
  );
}
