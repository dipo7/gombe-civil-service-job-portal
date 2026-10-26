import { z } from "zod";
import {
  ALLOWED_RESUME_EXTENSIONS,
  ALLOWED_RESUME_MIME,
  ALLOWED_DOCUMENT_MIME,
  DEGREE_CLASS_VALUES,
  DEGREE_TYPES,
  GOMBE_LGAS,
  GOMBE_STATE,
  MAX_RESUME_BYTES,
  NIGERIAN_STATES,
  COURSES,
  COURSE_OTHER,
  classesForType,
} from "./constants";
import { calculateAge, parseIsoDate } from "./age";

const cleanText = (min: number, max: number, label: string) =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    // Strip control characters (also blocks header injection when values reach email)
    .transform((v) => v.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(min, `${label} is required`)
        .max(max, `${label} must be at most ${max} characters`),
    );

const currentYear = () => new Date().getFullYear();

function cleanCourseName(v: string | undefined): string {
  return (v ?? "").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

/** The course to store: the typed name when "Other" is chosen, otherwise the selected course. */
export function resolveCourse(data: { course: string; courseOther?: string }): string {
  return data.course === COURSE_OTHER ? cleanCourseName(data.courseOther) : data.course;
}

export const applicationFieldsSchema = z
  .object({
    // Personal information
    fullName: cleanText(3, 120, "Full name").pipe(
      z.string().regex(/^[\p{L}][\p{L}\s.'’-]+$/u, "Full name contains invalid characters"),
    ),
    email: z
      .string({ required_error: "Email is required" })
      .trim()
      .toLowerCase()
      .max(254)
      .email("Enter a valid email address"),
    phone: z
      .string({ required_error: "Phone number is required" })
      .trim()
      .regex(/^(\+234|0)[789][01]\d{8}$/, "Enter a valid Nigerian phone number"),
    stateOfOrigin: z.enum(NIGERIAN_STATES, { errorMap: () => ({ message: "Select your state of origin" }) }),
    lga: z.string().trim().max(60).optional().or(z.literal("")),
    dateOfBirth: z
      .string({ required_error: "Date of birth is required" })
      .trim()
      .refine((v) => parseIsoDate(v) !== null, "Enter a valid date of birth"),

    // Academic qualification
    degreeType: z.enum(DEGREE_TYPES, { errorMap: () => ({ message: "Select your degree type" }) }),
    degreeClass: z.enum(DEGREE_CLASS_VALUES, { errorMap: () => ({ message: "Select your degree class" }) }),
    institution: cleanText(2, 160, "Institution"),
    course: z
      .string({ required_error: "Select your course" })
      .trim()
      .min(1, "Select your course")
      .refine((v) => v === COURSE_OTHER || (COURSES as readonly string[]).includes(v), "Select your course"),
    courseOther: z.string().optional(),
    graduationYear: z.coerce
      .number({ invalid_type_error: "Enter a valid year" })
      .int()
      .min(1960, "Enter a valid year")
      .max(currentYear(), "Graduation year cannot be in the future"),

    // Declarations
    declaration: z.literal(true, { errorMap: () => ({ message: "You must confirm the information is accurate" }) }),
    consent: z.literal(true, { errorMap: () => ({ message: "You must accept the privacy notice to apply" }) }),
  })
  .superRefine((data, ctx) => {
    if (data.course === COURSE_OTHER) {
      const name = cleanCourseName(data.courseOther);
      if (name.length < 2 || name.length > 120 || !/^[\p{L}\p{N}][\p{L}\p{N}\s.,&'’()/+-]*$/u.test(name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["courseOther"],
          message: "Enter the name of your course",
        });
      }
    }

    if (!(classesForType(data.degreeType) as readonly string[]).includes(data.degreeClass)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["degreeClass"],
        message: "Degree class is not valid for the selected degree type",
      });
    }

    if (data.stateOfOrigin === GOMBE_STATE) {
      if (!data.lga || !(GOMBE_LGAS as readonly string[]).includes(data.lga)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["lga"],
          message: "Select your Local Government Area",
        });
      }
    } else if (data.lga) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["lga"],
        message: "LGA applies only to Gombe State",
      });
    }

    const dob = parseIsoDate(data.dateOfBirth);
    if (dob) {
      const age = calculateAge(dob);
      if (age < 16 || age > 80) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["dateOfBirth"],
          message: "Enter a valid date of birth",
        });
      }
    }
  });

export type ApplicationFields = z.infer<typeof applicationFieldsSchema>;
export type ApplicationFormInput = z.input<typeof applicationFieldsSchema>;

/** Field names grouped by wizard step (client-side per-step validation). */
export const STEP_FIELDS = {
  personal: ["fullName", "email", "phone", "stateOfOrigin", "lga", "dateOfBirth"],
  academic: ["degreeType", "degreeClass", "course", "courseOther", "institution", "graduationYear"],
  declaration: ["declaration", "consent"],
} as const satisfies Record<string, readonly (keyof ApplicationFormInput)[]>;

export const jobIdSchema = z.string().trim().min(10).max(40).regex(/^[a-z0-9]+$/i);

// ---- Resume file validation (server) ----

function extensionOf(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

export const resumeFileSchema = z
  .instanceof(File, { message: "Resume is required" })
  .refine((f) => f.size > 0, "Resume is required")
  .refine((f) => f.size <= MAX_RESUME_BYTES, "Resume must be 5MB or smaller")
  .refine((f) => f.type in ALLOWED_RESUME_MIME, "Resume must be a PDF or DOCX file")
  .refine(
    (f) => (ALLOWED_RESUME_EXTENSIONS as readonly string[]).includes(extensionOf(f.name)),
    "Resume must have a .pdf or .docx extension",
  )
  .refine((f) => {
    const expected = ALLOWED_RESUME_MIME[f.type as keyof typeof ALLOWED_RESUME_MIME];
    return expected === extensionOf(f.name);
  }, "Resume file type does not match its extension");

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 (DOCX is a zip)

/** Verifies file content signature, independent of the client-supplied MIME type. */
export function hasValidSignature(bytes: Uint8Array, kind: "pdf" | "docx"): boolean {
  const magic = kind === "pdf" ? PDF_MAGIC : ZIP_MAGIC;
  return magic.every((b, i) => bytes[i] === b);
}

export function safeDisplayFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "resume";
  const cleaned = base.replace(/[^\w.\- ]/g, "_").slice(0, 100);
  return cleaned || "resume";
}

// ---- Supporting documents (certificates, letters) ----

export const documentFileSchema = z
  .instanceof(File, { message: "File is required" })
  .refine((f) => f.size > 0, "File is empty")
  .refine((f) => f.size <= MAX_RESUME_BYTES, "File must be 5MB or smaller")
  .refine((f) => f.type in ALLOWED_DOCUMENT_MIME, "File must be a PDF, JPG or PNG")
  .refine((f) => {
    const exts = ALLOWED_DOCUMENT_MIME[f.type as keyof typeof ALLOWED_DOCUMENT_MIME] as readonly string[] | undefined;
    return !!exts && exts.includes(extensionOf(f.name));
  }, "File type does not match its extension");

const SIGNATURES: Record<string, number[]> = {
  "application/pdf": PDF_MAGIC,
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
};

export function hasValidDocumentSignature(bytes: Uint8Array, mime: string): boolean {
  const magic = SIGNATURES[mime];
  return !!magic && magic.every((b, i) => bytes[i] === b);
}
