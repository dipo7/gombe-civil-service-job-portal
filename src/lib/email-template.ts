import { PORTAL_NAME } from "./brand";
import {
  DEGREE_CLASS_LABELS,
  DEGREE_TYPE_LABELS,
  DOCUMENT_LABELS,
  type DegreeClassValue,
  type DegreeTypeValue,
  type DocumentTypeValue,
} from "./constants";

const escapeHtml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const header = `<div style="background:#14532d;color:#fff;padding:12px 16px;border-bottom:4px solid #f5b50a;font-weight:bold">${escapeHtml(PORTAL_NAME)}</div>`;
const wrap = (body: string) =>
  `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#111827">${header}${body}</body></html>`;

type EmailApplication = {
  id: string;
  reference: string;
  fullName: string;
  email: string;
  phone: string;
  stateOfOrigin: string;
  lga: string | null;
  dateOfBirth: Date;
  degreeType: DegreeTypeValue;
  degreeClass: DegreeClassValue;
  institution: string;
  course: string;
  graduationYear: number;
  submittedAt: Date;
  documents: { type: DocumentTypeValue }[];
};

type EmailJob = { id: string; title: string; department: string };

/** HR notification for a screened-in applicant. */
export function buildApplicationEmail(app: EmailApplication, job: EmailJob, appUrl: string) {
  const portalLink = `${appUrl.replace(/\/$/, "")}/admin/applicants/${app.id}`;
  const rows: [string, string][] = [
    ["Reference", app.reference],
    ["Full name", app.fullName],
    ["Email (verified)", app.email],
    ["Phone", app.phone],
    ["State of origin", app.lga ? `${app.stateOfOrigin} (${app.lga} LGA)` : app.stateOfOrigin],
    ["Date of birth", app.dateOfBirth.toISOString().slice(0, 10)],
    ["Degree type", DEGREE_TYPE_LABELS[app.degreeType]],
    ["Degree class", DEGREE_CLASS_LABELS[app.degreeClass]],
    ["Institution", app.institution],
    ["Course", app.course],
    ["Graduation year", String(app.graduationYear)],
    ["Supporting documents", app.documents.map((d) => DOCUMENT_LABELS[d.type]).join(", ") || "None"],
    ["Submitted", app.submittedAt.toISOString()],
  ];

  const tableRows = rows
    .map(
      ([k, v]) =>
        `<tr><th align="left" style="padding:8px 12px;background:#f3f4f6;border:1px solid #e5e7eb;width:180px">${escapeHtml(k)}</th>` +
        `<td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(v)}</td></tr>`,
    )
    .join("");

  const html = wrap(`
<h2 style="margin:16px 0 4px">New application: ${escapeHtml(job.title)}</h2>
<p style="margin:0 0 16px;color:#6b7280">${escapeHtml(job.department)} &middot; Job ID ${escapeHtml(job.id)}</p>
<p>This candidate met all automated eligibility criteria. The resume is attached; supporting documents, notes and shortlisting are in the admin portal.</p>
<table style="border-collapse:collapse;font-size:14px">${tableRows}</table>
<p style="margin-top:16px"><a href="${escapeHtml(portalLink)}">Open in admin portal</a></p>`);

  const text = [
    `New application: ${job.title} (${job.department})`,
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Admin portal: ${portalLink}`,
  ].join("\n");

  return { subject: `[Application] ${job.title} - ${app.fullName}`.replace(/[\r\n]+/g, " "), html, text };
}

/** Acknowledgement sent to every applicant. Identical for screened-in and screened-out. */
export function buildConfirmationEmail(app: { fullName: string; reference: string; submittedAt: Date }, job: { title: string }) {
  const when = app.submittedAt.toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" });
  const html = wrap(`
<h2 style="margin:16px 0 4px">Application received</h2>
<p>Dear ${escapeHtml(app.fullName)},</p>
<p>We have received your application for <strong>${escapeHtml(job.title)}</strong> on ${escapeHtml(when)}.</p>
<p style="background:#f3f4f6;border:1px solid #e5e7eb;padding:12px 16px;display:inline-block">
  Your reference number: <strong style="font-size:18px;letter-spacing:1px">${escapeHtml(app.reference)}</strong>
</p>
<p>Please keep this number and quote it in any correspondence. Only shortlisted candidates will be contacted. Recruitment is free: never pay anyone to secure a position.</p>`);
  const text = `Dear ${app.fullName},\n\nWe have received your application for ${job.title} on ${when}.\nYour reference number: ${app.reference}\n\nOnly shortlisted candidates will be contacted. Recruitment is free: never pay anyone to secure a position.\n\n${PORTAL_NAME}`;
  return { subject: `Application received (${app.reference})`, html, text };
}
