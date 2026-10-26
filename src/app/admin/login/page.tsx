import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "@/components/admin/login-form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await getAdmin()) redirect("/admin");

  return (
    <div className="mx-auto max-w-sm">
      <Card>
        <CardHeader>
          <CardTitle>Administrator sign in</CardTitle>
          <p className="text-sm text-muted-foreground">Authorised Civil Service Commission staff only.</p>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </div>
  );
}
