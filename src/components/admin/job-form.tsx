"use client";

import { startTransition, useActionState } from "react";
import Link from "next/link";
import {
  DEGREE_CLASS_LABELS,
  DEGREE_TYPES,
  DEGREE_TYPE_LABELS,
  GOMBE_LGAS,
  classesForType,
  type DegreeClassValue,
  type DegreeTypeValue,
} from "@/lib/constants";
import type { FormState } from "@/app/admin/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export type JobFormInitial = {
  title: string;
  department: string;
  location: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  hrEmail: string;
  closesAt: string;
  isOpen: boolean;
  minAge: number | null;
  maxAge: number | null;
  requireGombeOrigin: boolean;
  allowedLgas: string[];
  degreeRules: { type: DegreeTypeValue; minClass: DegreeClassValue }[];
};

export const EMPTY_JOB: JobFormInitial = {
  title: "",
  department: "",
  location: "Gombe, Gombe State",
  description: "",
  responsibilities: [],
  requirements: [],
  hrEmail: "",
  closesAt: "",
  isOpen: true,
  minAge: null,
  maxAge: null,
  requireGombeOrigin: false,
  allowedLgas: [],
  degreeRules: [],
};

const checkbox = "h-4 w-4 rounded border-input accent-[hsl(var(--primary))]";

export function JobForm({
  action,
  initial,
  departments,
  submitLabel,
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  initial: JobFormInitial;
  departments: string[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const e = state.errors ?? {};
  const aria = (n: string) => ({ "aria-invalid": !!e[n], "aria-describedby": e[n] ? `${n}-error` : undefined });

  return (
    // Manual submit keeps typed values on validation errors (React 19 resets uncontrolled forms after actions).
    <form
      noValidate
      onSubmit={(ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.currentTarget);
        startTransition(() => formAction(fd));
      }}
      className="space-y-6"
    >
      {state.message && (
        <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {state.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="title" label="Job title" error={e.title}>
            <Input id="title" name="title" defaultValue={initial.title} {...aria("title")} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="department" label="Department / MDA" error={e.department}>
              <Input id="department" name="department" list="departments" defaultValue={initial.department} {...aria("department")} />
              <datalist id="departments">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            <Field id="location" label="Location" error={e.location}>
              <Input id="location" name="location" defaultValue={initial.location} {...aria("location")} />
            </Field>
          </div>
          <Field id="description" label="Role description" error={e.description}>
            <Textarea id="description" name="description" rows={5} defaultValue={initial.description} {...aria("description")} />
          </Field>
          <Field id="responsibilities" label="Responsibilities" hint="One per line" error={e.responsibilities}>
            <Textarea id="responsibilities" name="responsibilities" rows={5} defaultValue={initial.responsibilities.join("\n")} {...aria("responsibilities")} />
          </Field>
          <Field id="requirements" label="Additional requirements" hint="One per line. Eligibility rules below are listed automatically." error={e.requirements}>
            <Textarea id="requirements" name="requirements" rows={4} defaultValue={initial.requirements.join("\n")} {...aria("requirements")} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automated screening rules</CardTitle>
          <p className="text-sm text-muted-foreground">
            Applicants failing any rule are screened out silently and never reach HR.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="minAge" label="Minimum age" hint="Leave blank for no limit" error={e.minAge}>
              <Input id="minAge" name="minAge" type="number" min={14} max={80} defaultValue={initial.minAge ?? ""} {...aria("minAge")} />
            </Field>
            <Field id="maxAge" label="Maximum age" error={e.maxAge}>
              <Input id="maxAge" name="maxAge" type="number" min={14} max={80} defaultValue={initial.maxAge ?? ""} {...aria("maxAge")} />
            </Field>
          </div>

          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="requireGombeOrigin" defaultChecked={initial.requireGombeOrigin} className={checkbox} />
              Gombe State indigenes only
            </label>
            <fieldset className="space-y-2">
              <legend className="text-sm text-muted-foreground">Restrict to LGAs (none selected = all LGAs)</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {GOMBE_LGAS.map((l) => (
                  <label key={l} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="allowedLgas" value={l} defaultChecked={initial.allowedLgas.includes(l)} className={checkbox} />
                    {l}
                  </label>
                ))}
              </div>
              {e.allowedLgas && <p role="alert" className="text-xs font-medium text-destructive">{e.allowedLgas}</p>}
            </fieldset>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Accepted qualifications</legend>
            <p className="text-xs text-muted-foreground">Tick none to accept any degree type.</p>
            {DEGREE_TYPES.map((t) => {
              const rule = initial.degreeRules.find((r) => r.type === t);
              return (
                <div key={t} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name={`accept_${t}`} defaultChecked={!!rule} className={checkbox} />
                    {DEGREE_TYPE_LABELS[t]}
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Minimum class</span>
                    <Select name={`minClass_${t}`} defaultValue={rule?.minClass ?? classesForType(t)[classesForType(t).length - 1]} className="w-48">
                      {classesForType(t).map((c) => (
                        <option key={c} value={c}>
                          {DEGREE_CLASS_LABELS[c]}
                        </option>
                      ))}
                    </Select>
                  </label>
                </div>
              );
            })}
            {e.degreeRules && <p role="alert" className="text-xs font-medium text-destructive">{e.degreeRules}</p>}
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Publishing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field id="hrEmail" label="HR mailbox for screened-in applications" hint="Never shown publicly" error={e.hrEmail}>
            <Input id="hrEmail" name="hrEmail" type="email" defaultValue={initial.hrEmail} {...aria("hrEmail")} />
          </Field>
          <Field id="closesAt" label="Closing date" hint="Optional" error={e.closesAt}>
            <Input id="closesAt" name="closesAt" type="date" defaultValue={initial.closesAt} {...aria("closesAt")} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" name="isOpen" defaultChecked={initial.isOpen} className={checkbox} />
            Open for applications
          </label>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : submitLabel}
        </Button>
        <Link href="/admin" className={cn(buttonVariants({ variant: "outline" }))}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
