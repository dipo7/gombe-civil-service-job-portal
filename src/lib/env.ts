import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1),
    GCS_BUCKET: z.string().min(1),
    GCS_PROJECT_ID: z.string().optional(),
    GCS_CREDENTIALS_JSON: z.string().optional(),
    GCS_API_ENDPOINT: z.string().optional(),
    SMTP_HOST: z.string().min(1),
    SMTP_PORT: z.coerce.number().int().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    MAIL_FROM: z.string().min(1),
    CLAMAV_HOST: z.string().optional(),
    CLAMAV_PORT: z.coerce.number().int().default(3310),
    APP_URL: z.string().url().default("http://localhost:3000"),
    TURNSTILE_SECRET_KEY: z.string().optional(),
    // Pilot only: set "false" when the site is already behind Cloudflare Access.
    REQUIRE_CAPTCHA: z.enum(["true", "false"]).default("true"),
    RETENTION_SCREENED_OUT_DAYS: z.coerce.number().int().min(1).default(90),
    RETENTION_APPLICATIONS_DAYS: z.coerce.number().int().min(1).default(365),
    PRIVACY_CONTACT_EMAIL: z.string().optional(),
  })
  .refine((e) => !isProd || e.REQUIRE_CAPTCHA === "false" || !!e.TURNSTILE_SECRET_KEY, {
    path: ["TURNSTILE_SECRET_KEY"],
    message: "TURNSTILE_SECRET_KEY is required in production (CAPTCHA must not be skipped)",
  })
  .refine((e) => !isProd || !!e.CLAMAV_HOST, {
    path: ["CLAMAV_HOST"],
    message: "CLAMAV_HOST is required in production (malware scanning must not be skipped)",
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/** Lazily validated so `next build` does not need runtime secrets. */
export function env(): Env {
  if (!cached) {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
      const details = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
      throw new Error(`Invalid environment configuration: ${details}`);
    }
    cached = parsed.data;
  }
  return cached;
}
