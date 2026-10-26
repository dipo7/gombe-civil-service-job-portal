import { randomInt } from "node:crypto";

const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/** Collapses aliases (a.b+x@gmail.com -> ab@gmail.com) so one person maps to one dedupe key. */
export function canonicalEmail(email: string): string {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const domain = rawDomain === "googlemail.com" ? "gmail.com" : rawDomain;
  let local = rawLocal.split("+")[0] ?? "";
  if (GMAIL_DOMAINS.has(domain)) local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** 08012345678 and +2348012345678 both become +2348012345678. */
export function normalizePhone(phone: string): string {
  const p = phone.replace(/[\s-]/g, "");
  return p.startsWith("0") ? `+234${p.slice(1)}` : p;
}

// No 0/O/1/I to avoid transcription mistakes when read over the phone.
const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReference(): string {
  let id = "";
  for (let i = 0; i < 8; i++) id += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `GSC-${id}`;
}
