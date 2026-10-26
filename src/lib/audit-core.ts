import { prisma } from "./prisma";

export type AuditEntry = {
  adminEmail: string;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: string;
  ip?: string;
};

/** Never throws: an audit failure must not block the operation it describes, but is logged loudly. */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: { ...entry, details: entry.details?.slice(0, 500) },
    });
  } catch (e) {
    console.error("[audit] failed to record", entry.action, e);
  }
}
