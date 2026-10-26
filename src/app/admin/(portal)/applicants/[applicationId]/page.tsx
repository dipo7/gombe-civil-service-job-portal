import Link from "next/link";
import { notFound } from "next/navigation";
import { addNote, deleteApplication, overrideScreening, retryDispatch, setDecision } from "@/app/admin/applicant-actions";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateAge } from "@/lib/age";
import { DEGREE_CLASS_LABELS, DEGREE_TYPE_LABELS, DOCUMENT_LABELS } from "@/lib/constants";
import { jobIdSchema } from "@/lib/validation";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApplicantDetailPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const admin = await requireAdmin();
  const { applicationId } = await params;
  if (!jobIdSchema.safeParse(applicationId).success) notFound();

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: { select: { id: true, title: true, department: true } }, documents: true, notes: { orderBy: { createdAt: "desc" } } },
  });
  if (!app) notFound();

  await audit(admin, "applicant.view", { type: "Application", id: app.id });

  const rows: [string, React.ReactNode][] = [
    ["Email", `${app.email} (verified)`],
    ["Phone", app.phone],
    ["State of origin", app.lga ? `${app.stateOfOrigin} (${app.lga} LGA)` : app.stateOfOrigin],
    ["Date of birth", `${app.dateOfBirth.toISOString().slice(0, 10)} (${calculateAge(app.dateOfBirth)} years)`],
    ["Degree", `${DEGREE_TYPE_LABELS[app.degreeType]} - ${DEGREE_CLASS_LABELS[app.degreeClass]}`],
    ["Course", app.course],
    ["Institution", `${app.institution}, ${app.graduationYear}`],
    ["Submitted", app.submittedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })],
    ["Consent", `Privacy notice ${app.consentVersion}, accepted ${app.consentAt.toLocaleDateString("en-NG", { dateStyle: "medium" })}`],
    ["Confirmation email", app.confirmationSentAt ? "Sent" : "Pending"],
  ];

  return (
    <div className="space-y-6">
      <Link href={`/admin/jobs/${app.job.id}/applicants`} className="text-sm text-muted-foreground hover:underline">
        &larr; Applicants for {app.job.title}
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{app.fullName}</h1>
          <p className="text-sm text-muted-foreground">
            {app.reference} &middot; {app.job.title}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge className={cn(app.status === "Screened_In" && "bg-green-100 text-green-800", app.status === "Screened_Out" && "bg-red-100 text-red-800")}>
            {app.status.replace("_", " ")}
            {app.screeningOverriddenBy && " (overridden)"}
          </Badge>
          <Badge
            className={cn(app.hrDecision === "Shortlisted" && "bg-green-100 text-green-800", app.hrDecision === "Rejected" && "bg-red-100 text-red-800")}
          >
            HR: {app.hrDecision}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="grid grid-cols-3 gap-2">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="col-span-2">{v}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Files</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span>Resume ({app.resumeFileName})</span>
                <a href={`/admin/resume/${app.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Download
                </a>
              </div>
              {app.documents.map((d) => (
                <div key={d.id} className="flex items-center justify-between">
                  <span>{DOCUMENT_LABELS[d.type]}</span>
                  <a href={`/admin/documents/${d.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Download
                  </a>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>HR decision</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <form action={setDecision.bind(null, app.id, "Shortlisted")}>
                <Button type="submit" size="sm" disabled={app.hrDecision === "Shortlisted"}>
                  Shortlist
                </Button>
              </form>
              <form action={setDecision.bind(null, app.id, "Rejected")}>
                <Button type="submit" size="sm" variant="outline" className="text-destructive" disabled={app.hrDecision === "Rejected"}>
                  Reject
                </Button>
              </form>
              {app.hrDecision !== "Undecided" && (
                <form action={setDecision.bind(null, app.id, "Undecided")}>
                  <Button type="submit" size="sm" variant="ghost">
                    Reset
                  </Button>
                </form>
              )}
              {app.hrDecidedByEmail && (
                <p className="w-full text-xs text-muted-foreground">
                  By {app.hrDecidedByEmail} on {app.hrDecidedAt?.toLocaleDateString("en-NG", { dateStyle: "medium" })}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {app.status === "Screened_Out" && (
        <Card>
          <CardHeader>
            <CardTitle>Screened out: manual review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc pl-5 text-muted-foreground">
              {app.screeningNotes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
            <form action={overrideScreening.bind(null, app.id)} className="space-y-2">
              <label htmlFor="reason" className="font-medium">
                Move to HR queue anyway (reason required, recorded in audit log)
              </label>
              <Textarea id="reason" name="reason" required minLength={3} maxLength={500} rows={2} />
              <Button type="submit" size="sm" variant="outline">
                Override and send to HR
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {app.status === "Screened_In" && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-6 text-sm">
            <span>
              Email to HR: <strong>{app.dispatchStatus}</strong>
              {app.dispatchedAt && ` (${app.dispatchedAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })})`}
            </span>
            {(app.dispatchStatus === "Failed" || app.dispatchStatus === "NotQueued") && (
              <form action={retryDispatch.bind(null, app.id)}>
                <Button type="submit" size="sm">
                  Retry email
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form action={addNote.bind(null, app.id)} className="space-y-2">
            <label htmlFor="body" className="sr-only">
              Add a note
            </label>
            <Textarea id="body" name="body" required minLength={3} maxLength={2000} rows={3} placeholder="Add an internal note" />
            <Button type="submit" size="sm">
              Add note
            </Button>
          </form>
          {app.notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {app.notes.map((n) => (
                <li key={n.id} className="rounded-md border p-3 text-sm">
                  <p className="whitespace-pre-line">{n.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {n.authorEmail} &middot; {n.createdAt.toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <details className="rounded-md border border-destructive/40 p-4 text-sm">
        <summary className="cursor-pointer font-medium text-destructive">Delete this applicant&apos;s data</summary>
        <p className="mt-2 text-muted-foreground">
          Permanently deletes the application, notes, resume, and documents (e.g. a data-subject erasure request). This cannot be undone.
        </p>
        <form action={deleteApplication.bind(null, app.id)} className="mt-3">
          <Button type="submit" size="sm" variant="outline" className="text-destructive">
            Permanently delete
          </Button>
        </form>
      </details>
    </div>
  );
}
