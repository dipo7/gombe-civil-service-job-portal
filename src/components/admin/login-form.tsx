"use client";

import { useActionState } from "react";
import { login, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(login, {});

  return (
    <form action={action} className="space-y-5">
      {state.message && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}
      <Field id="email" label="Email">
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </Field>
      <Field id="password" label="Password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
