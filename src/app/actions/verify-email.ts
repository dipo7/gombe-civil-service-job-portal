"use server";

import { requestIp } from "@/lib/audit";
import { confirmEmailCode, sendEmailCode } from "@/lib/email-verification";
import { z } from "zod";

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const codeSchema = z.string().trim().regex(/^\d{6}$/);

export async function requestEmailCode(email: string): Promise<{ ok: boolean; message?: string }> {
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) return { ok: false, message: "Enter a valid email address first." };
  try {
    return await sendEmailCode(parsed.data, await requestIp());
  } catch (e) {
    console.error("[verify] could not send code", e);
    return { ok: false, message: "We could not send the code. Please try again shortly." };
  }
}

export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<{ ok: boolean; token?: string; message?: string }> {
  const e = emailSchema.safeParse(email);
  const c = codeSchema.safeParse(code);
  if (!e.success || !c.success) return { ok: false, message: "Enter the 6-digit code." };
  return confirmEmailCode(e.data, c.data);
}
