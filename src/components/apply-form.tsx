"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { submitApplication } from "@/app/actions/apply";
import { requestEmailCode, verifyEmailCode } from "@/app/actions/verify-email";
import {
  ALLOWED_RESUME_EXTENSIONS,
  COURSES,
  COURSE_OTHER,
  DEGREE_CLASS_LABELS,
  DEGREE_TYPES,
  DEGREE_TYPE_LABELS,
  DOCUMENT_LABELS,
  GOMBE_LGAS,
  GOMBE_STATE,
  MAX_RESUME_BYTES,
  NIGERIAN_STATES,
  classesForType,
  type DegreeTypeValue,
  type DocumentTypeValue,
} from "@/lib/constants";
import { ALL_INSTITUTIONS, INSTITUTIONS_BY_TYPE } from "@/lib/institutions";
import {
  STEP_FIELDS,
  applicationFieldsSchema,
  type ApplicationFields,
  type ApplicationFormInput,
} from "@/lib/validation";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/form-controls";
import { Turnstile, turnstileEnabled } from "@/components/turnstile";
import { cn } from "@/lib/utils";

const STEPS = ["Personal", "Academic", "Documents", "Declaration"] as const;
const DOC_ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const DOC_EXTENSIONS = ["pdf", "jpg", "jpeg", "png"];
const OPTIONAL_DOCS: DocumentTypeValue[] = ["NyscCertificate"];

const extOf = (f: File) => f.name.split(".").pop()?.toLowerCase() ?? "";

function validateResume(file: File | null): string | undefined {
  if (!file) return "Resume is required";
  if (!(ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(extOf(file))) return "Resume must be a PDF or DOCX file";
  if (file.size > MAX_RESUME_BYTES) return "Resume must be 5MB or smaller";
  if (file.size === 0) return "Resume is empty";
  return undefined;
}

function validateDocument(file: File | null, required: boolean, label: string): string | undefined {
  if (!file) return required ? `${label} is required` : undefined;
  if (!DOC_EXTENSIONS.includes(extOf(file))) return "File must be a PDF, JPG or PNG";
  if (file.size > MAX_RESUME_BYTES) return "File must be 5MB or smaller";
  if (file.size === 0) return "File is empty";
  return undefined;
}

type Verified = { email: string; token: string };

export function ApplyForm({
  jobId,
  jobTitle,
  requireOriginLetter,
}: {
  jobId: string;
  jobTitle: string;
  requireOriginLetter: boolean;
}) {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<{ reference?: string } | null>(null);
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const [resume, setResume] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string>();
  const [docs, setDocs] = useState<Partial<Record<DocumentTypeValue, File | null>>>({});
  const [docErrors, setDocErrors] = useState<Partial<Record<DocumentTypeValue, string>>>({});

  const [verified, setVerified] = useState<Verified | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [emailMsg, setEmailMsg] = useState<{ ok: boolean; text: string }>();
  const [emailBusy, startEmailTransition] = useTransition();

  const [captchaToken, setCaptchaToken] = useState("");
  const [captchaReset, setCaptchaReset] = useState(0);
  const resumeRef = useRef<HTMLInputElement>(null);

  const docTypes: DocumentTypeValue[] = ["DegreeCertificate", ...(requireOriginLetter ? (["OriginLetter"] as const) : []), ...OPTIONAL_DOCS];

  const {
    register,
    handleSubmit,
    trigger,
    watch,
    setValue,
    getValues,
    setError,
    formState: { errors },
  } = useForm<ApplicationFormInput, unknown, ApplicationFields>({
    resolver: zodResolver(applicationFieldsSchema),
    mode: "onTouched",
    defaultValues: { stateOfOrigin: undefined, lga: "", degreeType: undefined, degreeClass: undefined, declaration: false as never, consent: false as never },
  });

  const state = watch("stateOfOrigin");
  const degreeType = watch("degreeType") as DegreeTypeValue | undefined;
  const course = watch("course");
  const today = new Date().toISOString().slice(0, 10);

  const err = (name: keyof ApplicationFormInput) => errors[name]?.message as string | undefined;
  const aria = (name: keyof ApplicationFormInput) => ({
    "aria-invalid": !!errors[name],
    "aria-describedby": errors[name] ? `${name}-error` : undefined,
  });

  function sendCode() {
    startEmailTransition(async () => {
      if (!(await trigger("email"))) return;
      const res = await requestEmailCode(getValues("email"));
      setCodeSent(res.ok);
      setEmailMsg({ ok: res.ok, text: res.ok ? "We sent a 6-digit code to your email. It expires in 10 minutes." : (res.message ?? "Could not send code.") });
    });
  }

  function confirmCode() {
    startEmailTransition(async () => {
      const email = getValues("email");
      const res = await verifyEmailCode(email, code);
      if (res.ok && res.token) {
        setVerified({ email: email.trim().toLowerCase(), token: res.token });
        setEmailMsg(undefined);
      } else {
        setEmailMsg({ ok: false, text: res.message ?? "Could not verify code." });
      }
    });
  }

  async function next() {
    if (step === 0) {
      const valid = await trigger([...STEP_FIELDS.personal]);
      const emailOk = verified && verified.email === getValues("email").trim().toLowerCase();
      if (valid && !emailOk) {
        setEmailMsg({ ok: false, text: "Verify your email address to continue." });
        return;
      }
      if (!valid) return;
    } else if (step === 1) {
      if (!(await trigger([...STEP_FIELDS.academic]))) return;
    } else if (step === 2) {
      const rErr = validateResume(resume);
      const dErrs: Partial<Record<DocumentTypeValue, string>> = {};
      for (const t of docTypes) dErrs[t] = validateDocument(docs[t] ?? null, !OPTIONAL_DOCS.includes(t), DOCUMENT_LABELS[t]);
      setResumeError(rErr);
      setDocErrors(dErrs);
      if (rErr || Object.values(dErrs).some(Boolean)) return;
    }
    setStep(step + 1);
  }

  function onInvalid(errs: typeof errors) {
    const keys = Object.keys(errs);
    if (keys.some((k) => (STEP_FIELDS.personal as readonly string[]).includes(k))) setStep(0);
    else if (keys.some((k) => (STEP_FIELDS.academic as readonly string[]).includes(k))) setStep(1);
  }

  function onSubmit(values: ApplicationFields) {
    if (!resume || !verified) return;
    if (turnstileEnabled && !captchaToken) {
      setFormError("Please complete the human verification check.");
      return;
    }

    const fd = new FormData();
    for (const [k, v] of Object.entries(values)) fd.append(k, v == null ? "" : String(v));
    fd.append("resume", resume);
    for (const t of docTypes) {
      const f = docs[t];
      if (f) fd.append(`doc_${t}`, f);
    }
    fd.append("emailToken", verified.token);
    fd.append("captchaToken", captchaToken);

    setFormError(undefined);
    startTransition(async () => {
      const result = await submitApplication(jobId, fd);
      if (result.ok) {
        setDone({ reference: result.reference });
        return;
      }
      setFormError(result.message);
      setCaptchaReset((n) => n + 1);

      let firstStep = 3;
      const newDocErrors: Partial<Record<DocumentTypeValue, string>> = {};
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (field === "resume") {
          setResumeError(message);
          firstStep = Math.min(firstStep, 2);
        } else if (field.startsWith("doc_")) {
          newDocErrors[field.slice(4) as DocumentTypeValue] = message;
          firstStep = Math.min(firstStep, 2);
        } else {
          setError(field as keyof ApplicationFormInput, { message });
          if (field === "email") setVerified(null);
          if ((STEP_FIELDS.personal as readonly string[]).includes(field)) firstStep = Math.min(firstStep, 0);
          else if ((STEP_FIELDS.academic as readonly string[]).includes(field)) firstStep = Math.min(firstStep, 1);
        }
      }
      setDocErrors(newDocErrors);
      setStep(firstStep);
    });
  }

  if (done) {
    return (
      <Card>
        <CardContent className="space-y-3 p-8 text-center" role="status">
          <h2 className="text-xl font-semibold">Application received</h2>
          {done.reference ? (
            <>
              <p className="text-muted-foreground">Thank you for applying for {jobTitle}. Your reference number is:</p>
              <p className="text-2xl font-bold tracking-widest text-primary">{done.reference}</p>
              <p className="text-sm text-muted-foreground">
                A confirmation has been sent to your email. Keep this number for any correspondence. Only shortlisted
                candidates will be contacted.
              </p>
            </>
          ) : (
            <p className="text-muted-foreground">
              If you have already applied for {jobTitle}, your earlier application remains valid and has not been replaced.
              Only shortlisted candidates will be contacted.
            </p>
          )}
          <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
            Back to open positions
          </Link>
        </CardContent>
      </Card>
    );
  }

  const emailVerified = !!verified && verified.email === (watch("email") ?? "").trim().toLowerCase();

  return (
    <>
      <ol className="mb-6 flex gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? "step" : undefined}
            className={cn(
              "flex-1 rounded-md border px-2 py-2 text-center text-xs sm:text-sm",
              i === step ? "border-primary bg-primary text-primary-foreground" : i < step ? "bg-secondary" : "bg-background text-muted-foreground",
            )}
          >
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate>
        <Card>
          <CardContent className="space-y-5 p-6">
            {formError && (
              <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {formError}
              </p>
            )}

            <fieldset className={step === 0 ? "space-y-5" : "hidden"} disabled={pending}>
              <Field id="fullName" label="Full name" error={err("fullName")}>
                <Input id="fullName" autoComplete="name" {...register("fullName")} {...aria("fullName")} />
              </Field>
              <Field id="email" label="Email address" error={err("email")}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register("email", {
                    onChange: () => {
                      setCodeSent(false);
                      setCode("");
                      setEmailMsg(undefined);
                    },
                  })}
                  {...aria("email")}
                />
              </Field>

              {emailVerified ? (
                <p role="status" className="rounded-md border border-green-300 bg-green-50 p-2 text-sm text-green-800">
                  Email verified.
                </p>
              ) : (
                <div className="space-y-3 rounded-md border bg-muted/40 p-3">
                  <p className="text-sm">We need to verify your email address before you continue.</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={sendCode} disabled={emailBusy}>
                      {codeSent ? "Resend code" : "Send verification code"}
                    </Button>
                    {codeSent && (
                      <>
                        <div className="w-36">
                          <label htmlFor="otp" className="sr-only">
                            6-digit code
                          </label>
                          <Input id="otp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                        </div>
                        <Button type="button" size="sm" onClick={confirmCode} disabled={emailBusy || code.length !== 6}>
                          Verify
                        </Button>
                      </>
                    )}
                  </div>
                  {emailMsg && (
                    <p role={emailMsg.ok ? "status" : "alert"} className={cn("text-xs", emailMsg.ok ? "text-muted-foreground" : "font-medium text-destructive")}>
                      {emailMsg.text}
                    </p>
                  )}
                </div>
              )}

              <Field id="phone" label="Phone number" hint="e.g. 08012345678" error={err("phone")}>
                <Input id="phone" type="tel" autoComplete="tel" {...register("phone")} {...aria("phone")} />
              </Field>
              <Field id="stateOfOrigin" label="State of origin" error={err("stateOfOrigin")}>
                <Select
                  id="stateOfOrigin"
                  defaultValue=""
                  {...register("stateOfOrigin", { onChange: (e) => e.target.value !== GOMBE_STATE && setValue("lga", "") })}
                  {...aria("stateOfOrigin")}
                >
                  <option value="" disabled>
                    Select state
                  </option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              {state === GOMBE_STATE && (
                <Field id="lga" label="Local Government Area" error={err("lga")}>
                  <Select id="lga" defaultValue="" {...register("lga")} {...aria("lga")}>
                    <option value="" disabled>
                      Select LGA
                    </option>
                    {GOMBE_LGAS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field id="dateOfBirth" label="Date of birth" error={err("dateOfBirth")}>
                <Input id="dateOfBirth" type="date" max={today} autoComplete="bday" {...register("dateOfBirth")} {...aria("dateOfBirth")} />
              </Field>
            </fieldset>

            <fieldset className={step === 1 ? "space-y-5" : "hidden"} disabled={pending}>
              <Field id="degreeType" label="Degree type" error={err("degreeType")}>
                <Select
                  id="degreeType"
                  defaultValue=""
                  {...register("degreeType", { onChange: () => setValue("degreeClass", "" as never) })}
                  {...aria("degreeType")}
                >
                  <option value="" disabled>
                    Select degree type
                  </option>
                  {DEGREE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {DEGREE_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              {degreeType && (
                <Field id="degreeClass" label="Degree class" error={err("degreeClass")}>
                  <Select id="degreeClass" defaultValue="" {...register("degreeClass")} {...aria("degreeClass")}>
                    <option value="" disabled>
                      Select class
                    </option>
                    {classesForType(degreeType).map((c) => (
                      <option key={c} value={c}>
                        {DEGREE_CLASS_LABELS[c]}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field id="course" label="Course of study" error={err("course")}>
                <Select id="course" defaultValue="" {...register("course")} {...aria("course")}>
                  <option value="" disabled>
                    Select course
                  </option>
                  {COURSES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                  <option value={COURSE_OTHER}>{COURSE_OTHER} (type your course)</option>
                </Select>
              </Field>
              {course === COURSE_OTHER && (
                <Field id="courseOther" label="Name of your course" error={err("courseOther")}>
                  <Input id="courseOther" {...register("courseOther")} {...aria("courseOther")} />
                </Field>
              )}
              <Field id="institution" label="Institution" hint="Pick a suggestion or type your own" error={err("institution")}>
                <Input id="institution" list="institution-options" autoComplete="off" {...register("institution")} {...aria("institution")} />
                <datalist id="institution-options">
                  {(degreeType ? INSTITUTIONS_BY_TYPE[degreeType] : ALL_INSTITUTIONS).map((i) => (
                    <option key={i} value={i} />
                  ))}
                </datalist>
              </Field>
              <Field id="graduationYear" label="Year of graduation" error={err("graduationYear")}>
                <Input id="graduationYear" type="number" inputMode="numeric" {...register("graduationYear")} {...aria("graduationYear")} />
              </Field>
            </fieldset>

            <fieldset className={step === 2 ? "space-y-5" : "hidden"} disabled={pending}>
              <Field id="resume" label="Resume / CV" hint="PDF or DOCX, maximum 5MB" error={resumeError}>
                <Input
                  id="resume"
                  ref={resumeRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="h-auto cursor-pointer py-2"
                  aria-invalid={!!resumeError}
                  aria-describedby={resumeError ? "resume-error" : undefined}
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setResume(f);
                    setResumeError(f ? validateResume(f) : undefined);
                  }}
                />
              </Field>
              {docTypes.map((t) => (
                <Field
                  key={t}
                  id={`doc_${t}`}
                  label={`${DOCUMENT_LABELS[t]}${OPTIONAL_DOCS.includes(t) ? " (optional)" : ""}`}
                  hint="PDF, JPG or PNG, maximum 5MB"
                  error={docErrors[t]}
                >
                  <Input
                    id={`doc_${t}`}
                    type="file"
                    accept={DOC_ACCEPT}
                    className="h-auto cursor-pointer py-2"
                    aria-invalid={!!docErrors[t]}
                    aria-describedby={docErrors[t] ? `doc_${t}-error` : undefined}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setDocs((d) => ({ ...d, [t]: f }));
                      setDocErrors((d) => ({ ...d, [t]: f ? validateDocument(f, false, DOCUMENT_LABELS[t]) : undefined }));
                    }}
                  />
                </Field>
              ))}
            </fieldset>

            <fieldset className={step === 3 ? "space-y-4" : "hidden"} disabled={pending}>
              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" {...register("declaration")} />
                <span>
                  I declare that all information and documents I have provided are true and accurate. I understand that false
                  information will lead to disqualification.
                </span>
              </label>
              {err("declaration") && <p role="alert" className="text-xs font-medium text-destructive">{err("declaration")}</p>}

              <label className="flex items-start gap-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-[hsl(var(--primary))]" {...register("consent")} />
                <span>
                  I consent to the collection and processing of my personal data for recruitment as described in the{" "}
                  <Link href="/privacy" target="_blank" className="text-primary underline">
                    Privacy Notice
                  </Link>
                  .
                </span>
              </label>
              {err("consent") && <p role="alert" className="text-xs font-medium text-destructive">{err("consent")}</p>}

              <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />
            </fieldset>

            <div className="flex justify-between pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(step - 1)} disabled={step === 0 || pending}>
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button type="button" onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button type="submit" disabled={pending}>
                  Submit application
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>

      {pending && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-busy="true"
          aria-label="Processing your application"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
        >
          <div className="space-y-3 rounded-lg border bg-card p-8 text-center shadow-lg">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="font-medium">Processing your application&hellip;</p>
            <p className="text-sm text-muted-foreground">Uploading and scanning your documents. Please do not close or refresh this page.</p>
          </div>
        </div>
      )}
    </>
  );
}
