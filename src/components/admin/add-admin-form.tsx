"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { createAdmin, type FormState } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form-controls";

export function AddAdminForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createAdmin, {});
  const ref = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    // Manual submit keeps typed values on validation errors (React 19 resets uncontrolled forms after actions).
    <form
      ref={ref}
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => action(fd));
      }}
      className="space-y-4"
    >
      {state.message && (
        <p
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-md border border-green-300 bg-green-50 p-3 text-sm text-green-800"
              : "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          }
        >
          {state.message}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Full name" error={e.name}>
          <Input id="name" name="name" autoComplete="off" />
        </Field>
        <Field id="email" label="Email" error={e.email}>
          <Input id="email" name="email" type="email" autoComplete="off" />
        </Field>
        <Field id="password" label="Temporary password" hint="At least 12 characters" error={e.password}>
          <Input id="password" name="password" type="password" autoComplete="new-password" />
        </Field>
        <Field id="confirm" label="Confirm password" error={e.confirm}>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" />
        </Field>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Adding..." : "Add administrator"}
      </Button>
    </form>
  );
}
