import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { calculateAge } from "@/lib/age";
import { resolveFilter } from "@/lib/applicant-filters";
import { DEGREE_CLASS_LABELS, DEGREE_TYPE_LABELS } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { jobIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Spreadsheet apps execute cells starting with these characters as formulas.
function cell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const HEADERS = [
  "Reference",
  "Name",
  "Email",
  "Phone",
  "State of origin",
  "LGA",
  "Age",
  "Degree type",
  "Degree class",
  "Course",
  "Institution",
  "Graduation year",
  "Screening",
  "Screening override",
  "HR decision",
  "Email to HR",
  "Submitted (UTC)",
];

export async function GET(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { jobId } = await params;
  if (!jobIdSchema.safeParse(jobId).success) return new Response("Not found", { status: 404 });

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { title: true } });
  if (!job) return new Response("Not found", { status: 404 });

  const filter = resolveFilter(new URL(req.url).searchParams.get("status") ?? undefined);
  const apps = await prisma.application.findMany({
    where: { jobId, ...filter.where },
    orderBy: { submittedAt: "asc" },
  });

  await audit(admin, "applicants.export", { type: "Job", id: jobId }, `${filter.key}: ${apps.length} rows`);

  const now = new Date();
  const lines = [HEADERS.map(cell).join(",")];
  for (const a of apps) {
    lines.push(
      [
        a.reference,
        a.fullName,
        a.email,
        a.phone,
        a.stateOfOrigin,
        a.lga,
        calculateAge(a.dateOfBirth, now),
        DEGREE_TYPE_LABELS[a.degreeType],
        DEGREE_CLASS_LABELS[a.degreeClass],
        a.course,
        a.institution,
        a.graduationYear,
        a.status,
        a.screeningOverriddenBy ?? "",
        a.hrDecision,
        a.status === "Screened_In" ? a.dispatchStatus : "",
        a.submittedAt.toISOString(),
      ]
        .map(cell)
        .join(","),
    );
  }

  const filename = `applicants-${jobId}-${filter.key}.csv`;
  // BOM so Excel reads UTF-8 names correctly.
  return new Response("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
