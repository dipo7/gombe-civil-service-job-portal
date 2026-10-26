import { z } from "zod";
import {
  DEGREE_TYPES,
  GOMBE_LGAS,
  classesForType,
  type DegreeClassValue,
  type DegreeTypeValue,
} from "./constants";
import { parseIsoDate } from "./age";

const lines = (label: string, max: number, minCount: number) =>
  z
    .string()
    .transform((v) =>
      v
        .split(/\r?\n/)
        .map((l) => l.replace(/[\u0000-\u001F\u007F]/g, " ").trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().max(300, `Each ${label} line must be at most 300 characters`))
        .min(minCount, `Add at least ${minCount} ${label}`)
        .max(max, `At most ${max} ${label} lines`),
    );

const optionalInt = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .pipe(z.number({ invalid_type_error: `${label} must be a number` }).int().min(14, `${label} must be 14-80`).max(80, `${label} must be 14-80`).nullable());

const text = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, `${label} is required`)
    .max(max, `${label} must be at most ${max} characters`)
    .refine((v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v), `${label} contains invalid characters`);

export const jobFormSchema = z
  .object({
    title: text("Title", 3, 150),
    department: text("Department", 2, 100),
    location: text("Location", 2, 120),
    description: text("Description", 20, 6000),
    responsibilities: lines("responsibility", 30, 1),
    requirements: lines("requirement", 30, 0),
    hrEmail: z.string().trim().toLowerCase().max(254).email("Enter a valid HR email address"),
    closesAt: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const d = parseIsoDate(v);
        if (!d) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid closing date" });
          return z.NEVER;
        }
        // Applications close at the end of the chosen day (UTC).
        return new Date(d.getTime() + 86_400_000 - 1);
      }),
    isOpen: z.boolean(),
    minAge: optionalInt("Minimum age"),
    maxAge: optionalInt("Maximum age"),
    requireGombeOrigin: z.boolean(),
    allowedLgas: z.array(z.enum(GOMBE_LGAS)),
    degreeRules: z.array(
      z.object({
        type: z.enum(DEGREE_TYPES),
        minClass: z.string(),
      }),
    ),
  })
  .superRefine((d, ctx) => {
    if (d.minAge !== null && d.maxAge !== null && d.minAge > d.maxAge) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["maxAge"], message: "Maximum age must not be below minimum age" });
    }
    for (const r of d.degreeRules) {
      if (!(classesForType(r.type) as readonly string[]).includes(r.minClass)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["degreeRules"], message: `Invalid minimum class for ${r.type}` });
      }
    }
    if (d.allowedLgas.length > 0 && !d.requireGombeOrigin) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allowedLgas"],
        message: "Restricting by LGA requires 'Gombe State indigenes only'",
      });
    }
  });

export type JobFormData = z.infer<typeof jobFormSchema>;
export type ParsedDegreeRule = { type: DegreeTypeValue; minClass: DegreeClassValue };

export function readJobForm(fd: FormData) {
  const str = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");
  const degreeRules = DEGREE_TYPES.filter((t) => fd.get(`accept_${t}`) === "on").map((t) => ({
    type: t,
    minClass: str(`minClass_${t}`),
  }));

  return jobFormSchema.safeParse({
    title: str("title"),
    department: str("department"),
    location: str("location"),
    description: str("description"),
    responsibilities: str("responsibilities"),
    requirements: str("requirements"),
    hrEmail: str("hrEmail"),
    closesAt: str("closesAt"),
    isOpen: fd.get("isOpen") === "on",
    minAge: str("minAge"),
    maxAge: str("maxAge"),
    requireGombeOrigin: fd.get("requireGombeOrigin") === "on",
    allowedLgas: fd.getAll("allowedLgas").filter((v): v is string => typeof v === "string"),
    degreeRules,
  });
}
