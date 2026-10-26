import { headers } from "next/headers";
import { recordAudit } from "./audit-core";

export async function requestIp(): Promise<string> {
  const h = await headers();
  // Cloudflare sets cf-connecting-ip itself; x-forwarded-for's first entry can be client-supplied.
  return h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

/** Records an action by a signed-in admin, capturing the request IP. */
export async function audit(
  admin: { email: string },
  action: string,
  target?: { type: string; id: string },
  details?: string,
): Promise<void> {
  await recordAudit({
    adminEmail: admin.email,
    action,
    entityType: target?.type,
    entityId: target?.id,
    details,
    ip: await requestIp(),
  });
}
