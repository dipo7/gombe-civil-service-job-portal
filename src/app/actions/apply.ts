"use server";

import { Prisma } from "@prisma/client";
import {
  ALLOWED_DOCUMENT_MIME,
  ALLOWED_RESUME_MIME,
  DOCUMENT_LABELS,
  DOCUMENT_TYPES,
  PRIVACY_VERSION,
  type DocumentTypeValue,
} from "@/lib/constants";
import { requestIp } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { scanForMalware } from "@/lib/malware";
import { verifyCaptcha } from "@/lib/captcha";
import { consumeEmailToken, isEmailTokenValid } from "@/lib/email-verification";
import { canonicalEmail, generateReference, normalizePhone } from "@/lib/normalize";
import { enqueueEmail } from "@/lib/queue";
import { rateLimit } from "@/lib/rate-limit";
import { screenCandidate } from "@/lib/screening";
import { deleteObject, uploadDocument, uploadResume } from "@/lib/storage";
import { parseIsoDate } from "@/lib/age";
import {
  applicationFieldsSchema,
  documentFileSchema,
  hasValidDocumentSignature,
  hasValidSignature,
  jobIdSchema,
  resolveCourse,
  resumeFileSchema,
  safeDisplayFileName,
} from "@/lib/validation";

export type SubmitResult =
  | { ok: true; reference?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string> };

const GENERIC_ERROR = "We could not process your application right now. Please try again later.";
const FIELD_ERROR = "Please correct the highlighted fields.";
const TEXT_FIELDS = [
  "fullName",
  "email",
  "phone",
  "stateOfOrigin",
  "lga",
  "dateOfBirth",
  "degreeType",
  "degreeClass",
  "course",
  "courseOther",
  "institution",
  "graduationYear",
] as const;

const fail = (fieldErrors: Record<string, string>): SubmitResult => ({ ok: false, message: FIELD_ERROR, fieldErrors });

export async function submitApplication(jobId: string, formData: FormData): Promise<SubmitResult> {
  const uploadedKeys: string[] = [];

  try {
    const ip = await requestIp();
    if (!(await rateLimit(`apply:${ip}`, 10, 3600))) {
      return { ok: false, message: "Too many submissions. Please try again later." };
    }

    if (!(await verifyCaptcha(formData.get("captchaToken")?.toString(), ip))) {
      return { ok: false, message: "Please complete the human verification check and try again." };
    }

    const parsedJobId = jobIdSchema.safeParse(jobId);
    if (!parsedJobId.success) return { ok: false, message: "This position is no longer available." };

    // 1. Validate every field server-side before any verification logic runs.
    const raw: Record<string, unknown> = {};
    for (const key of TEXT_FIELDS) {
      const v = formData.get(key);
      raw[key] = typeof v === "string" ? v : undefined;
    }
    raw.declaration = formData.get("declaration") === "true";
    raw.consent = formData.get("consent") === "true";

    const fieldErrors: Record<string, string> = {};
    const fields = applicationFieldsSchema.safeParse(raw);
    if (!fields.success) {
      for (const issue of fields.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    }

    const resumeParsed = resumeFileSchema.safeParse(formData.get("resume"));
    if (!resumeParsed.success) fieldErrors.resume = resumeParsed.error.issues[0]?.message ?? "Invalid resume";

    const docFiles = new Map<DocumentTypeValue, File>();
    for (const type of DOCUMENT_TYPES) {
      const f = formData.get(`doc_${type}`);
      if (!(f instanceof File) || f.size === 0) continue;
      const parsed = documentFileSchema.safeParse(f);
      if (parsed.success) docFiles.set(type, parsed.data);
      else fieldErrors[`doc_${type}`] = parsed.error.issues[0]?.message ?? "Invalid file";
    }

    // 2. Load job and acceptance criteria.
    const job = await prisma.job.findUnique({
      where: { id: parsedJobId.data },
      include: { degreeRules: true },
    });
    if (!job || !job.isOpen || (job.closesAt && job.closesAt < new Date())) {
      return { ok: false, message: "This position is no longer accepting applications." };
    }

    const required: DocumentTypeValue[] = ["DegreeCertificate"];
    if (job.requireGombeOrigin || job.allowedLgas.length > 0) required.push("OriginLetter");
    for (const type of required) {
      if (!docFiles.has(type) && !fieldErrors[`doc_${type}`]) fieldErrors[`doc_${type}`] = `${DOCUMENT_LABELS[type]} is required`;
    }

    if (!fields.success || !resumeParsed.success || Object.keys(fieldErrors).length > 0) return fail(fieldErrors);

    const data = fields.data;
    const resume = resumeParsed.data;

    // 3. The email must have been verified in this session.
    const emailToken = formData.get("emailToken")?.toString() ?? "";
    if (!(await isEmailTokenValid(emailToken, data.email))) {
      return fail({ email: "Please verify your email address again" });
    }

    // Repeats are acknowledged identically; they cannot be used to probe the filter.
    const emailCanonical = canonicalEmail(data.email);
    const phoneNormalized = normalizePhone(data.phone);
    const existing = await prisma.application.findFirst({
      where: { jobId: job.id, OR: [{ emailCanonical }, { phoneNormalized }] },
      select: { id: true },
    });
    if (existing) return { ok: true };

    // 4. File security: content signature, malware scan, UUID-named private upload.
    const resumeKind = ALLOWED_RESUME_MIME[resume.type as keyof typeof ALLOWED_RESUME_MIME];
    const resumeBytes = Buffer.from(await resume.arrayBuffer());
    if (!hasValidSignature(resumeBytes, resumeKind)) {
      return fail({ resume: "Resume file is corrupted or not a valid PDF/DOCX" });
    }

    const docBytes = new Map<DocumentTypeValue, Buffer>();
    for (const [type, file] of docFiles) {
      const bytes = Buffer.from(await file.arrayBuffer());
      if (!hasValidDocumentSignature(bytes, file.type)) {
        return fail({ [`doc_${type}`]: "File is corrupted or not a valid PDF/JPG/PNG" });
      }
      docBytes.set(type, bytes);
    }

    const scanRejected = async (bytes: Buffer, label: string) => {
      const scan = await scanForMalware(bytes);
      if (!scan.clean) console.warn(`[apply] ${label} rejected by scanner:`, scan.reason);
      return !scan.clean;
    };
    if (await scanRejected(resumeBytes, "resume")) {
      return fail({ resume: "This file could not be accepted. Please upload a clean PDF or DOCX." });
    }
    for (const [type, bytes] of docBytes) {
      if (await scanRejected(bytes, type)) {
        return fail({ [`doc_${type}`]: "This file could not be accepted. Please upload a clean file." });
      }
    }

    const resumeKey = await uploadResume(resumeBytes, resumeKind, resume.type);
    uploadedKeys.push(resumeKey);
    const documents: Prisma.ApplicationDocumentCreateWithoutApplicationInput[] = [];
    for (const [type, file] of docFiles) {
      const ext = ALLOWED_DOCUMENT_MIME[file.type as keyof typeof ALLOWED_DOCUMENT_MIME][0];
      const key = await uploadDocument(docBytes.get(type)!, ext, file.type);
      uploadedKeys.push(key);
      documents.push({ type, key, fileName: safeDisplayFileName(file.name), mime: file.type, size: file.size });
    }

    // 5. Persist (retrying on the astronomically unlikely reference collision).
    await consumeEmailToken(emailToken);
    const dateOfBirth = parseIsoDate(data.dateOfBirth)!;
    const now = new Date();
    let created: { id: string; reference: string } | undefined;

    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      try {
        created = await prisma.application.create({
          data: {
            jobId: job.id,
            reference: generateReference(),
            fullName: data.fullName,
            email: data.email,
            emailCanonical,
            phone: data.phone,
            phoneNormalized,
            stateOfOrigin: data.stateOfOrigin,
            lga: data.lga || null,
            dateOfBirth,
            degreeType: data.degreeType,
            degreeClass: data.degreeClass,
            institution: data.institution,
            course: resolveCourse(data),
            graduationYear: data.graduationYear,
            resumeKey,
            resumeFileName: safeDisplayFileName(resume.name),
            resumeMime: resume.type,
            resumeSize: resume.size,
            emailVerifiedAt: now,
            consentAt: now,
            consentVersion: PRIVACY_VERSION,
            declarationAt: now,
            documents: { create: documents },
          },
          select: { id: true, reference: true },
        });
      } catch (e) {
        if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
        const target = String(e.meta?.target ?? "");
        // A concurrent duplicate submission: acknowledge it and discard this attempt's files.
        if (!target.includes("reference")) {
          await Promise.all(uploadedKeys.map((k) => deleteObject(k).catch(() => undefined)));
          return { ok: true };
        }
      }
    }
    if (!created) throw new Error("Could not allocate a unique reference");
    uploadedKeys.length = 0;

    // 6. Hard-filter screening.
    const outcome = screenCandidate(
      {
        dateOfBirth,
        stateOfOrigin: data.stateOfOrigin,
        lga: data.lga || null,
        degreeType: data.degreeType,
        degreeClass: data.degreeClass,
      },
      job,
    );

    if (!outcome.passed) {
      await prisma.application.update({
        where: { id: created.id },
        data: { status: "Screened_Out", screeningNotes: outcome.reasons },
      });
    } else {
      await prisma.application.update({ where: { id: created.id }, data: { status: "Screened_In" } });
    }

    // 7. Background work. Failures are recovered by the worker's sweeper.
    try {
      await enqueueEmail("confirm", created.id);
      if (outcome.passed) {
        await enqueueEmail("send", created.id);
        await prisma.application.update({ where: { id: created.id }, data: { dispatchStatus: "Queued" } });
      }
    } catch (e) {
      console.error("[apply] failed to enqueue email", created.id, e);
    }

    return { ok: true, reference: created.reference };
  } catch (e) {
    console.error("[apply] unexpected failure", e);
    await Promise.all(uploadedKeys.map((k) => deleteObject(k).catch(() => undefined)));
    return { ok: false, message: GENERIC_ERROR };
  }
}
