import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { redis } from "./redis";
import { rateLimit } from "./rate-limit";
import { sendMail } from "./mailer";
import { PORTAL_NAME } from "./brand";
import { canonicalEmail } from "./normalize";

const CODE_TTL = 600; // 10 minutes
const TOKEN_TTL = 3600; // verified email stays valid for 1 hour
const MAX_ATTEMPTS = 5;

const hashCode = (email: string, code: string) => createHash("sha256").update(`${email}:${code}`).digest("hex");
const codeKey = (email: string) => `otp:${canonicalEmail(email)}`;
const tokenKey = (token: string) => `emailtok:${token}`;

export type CodeResult = { ok: true } | { ok: false; message: string };

export async function sendEmailCode(email: string, ip: string): Promise<CodeResult> {
  const canon = canonicalEmail(email);
  if (!(await rateLimit(`otp-send-ip:${ip}`, 15, 3600)) || !(await rateLimit(`otp-send:${canon}`, 4, 900))) {
    return { ok: false, message: "Too many code requests. Please wait a few minutes and try again." };
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await redis().set(codeKey(email), JSON.stringify({ hash: hashCode(canon, code), attempts: 0 }), "EX", CODE_TTL);

  if (process.env.NODE_ENV !== "production") console.log(`[otp] ${email} -> ${code}`);

  await sendMail({
    to: email,
    subject: `${code} is your verification code`,
    text: `Your ${PORTAL_NAME} verification code is ${code}. It expires in 10 minutes. If you did not request it, ignore this email.`,
    html: `<p>Your <strong>${PORTAL_NAME}</strong> verification code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:bold">${code}</p><p>It expires in 10 minutes. If you did not request it, ignore this email.</p>`,
  });
  return { ok: true };
}

export async function confirmEmailCode(
  email: string,
  code: string,
): Promise<{ ok: true; token: string } | { ok: false; message: string }> {
  const canon = canonicalEmail(email);
  const raw = await redis().get(codeKey(email));
  if (!raw) return { ok: false, message: "Code expired. Request a new one." };

  const entry = JSON.parse(raw) as { hash: string; attempts: number };
  if (entry.attempts >= MAX_ATTEMPTS) {
    await redis().del(codeKey(email));
    return { ok: false, message: "Too many incorrect attempts. Request a new code." };
  }

  const expected = Buffer.from(entry.hash, "hex");
  const actual = Buffer.from(hashCode(canon, code), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    entry.attempts += 1;
    await redis().set(codeKey(email), JSON.stringify(entry), "KEEPTTL");
    return { ok: false, message: "Incorrect code." };
  }

  await redis().del(codeKey(email));
  const token = randomBytes(24).toString("base64url");
  await redis().set(tokenKey(token), canon, "EX", TOKEN_TTL);
  return { ok: true, token };
}

export async function isEmailTokenValid(token: string, email: string): Promise<boolean> {
  if (!token) return false;
  return (await redis().get(tokenKey(token))) === canonicalEmail(email);
}

/** Single use: call only once the application is about to be written. */
export async function consumeEmailToken(token: string): Promise<void> {
  await redis().del(tokenKey(token));
}
