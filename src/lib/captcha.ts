import { env } from "./env";

/** Verifies a Cloudflare Turnstile token. Skipped only when no secret is configured (non-production). */
export async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) return true;
  if (!token) return false;

  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: new URLSearchParams({ secret, response: token, ...(ip !== "unknown" ? { remoteip: ip } : {}) }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
