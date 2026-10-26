import { env } from "./env";
import { prisma } from "./prisma";
import { deleteObject } from "./storage";
import { recordAudit } from "./audit-core";

const DAY_MS = 86_400_000;

/**
 * Deletes applications (and their stored files) past the retention window.
 * Screened-out applicants are kept for a shorter period than everyone else.
 * A row is only removed after all of its files were deleted, so failures retry next run.
 */
export async function purgeExpired(now = new Date()): Promise<{ applications: number; files: number }> {
  const e = env();
  const screenedOutCutoff = new Date(now.getTime() - e.RETENTION_SCREENED_OUT_DAYS * DAY_MS);
  const allCutoff = new Date(now.getTime() - e.RETENTION_APPLICATIONS_DAYS * DAY_MS);

  let applications = 0;
  let files = 0;

  for (;;) {
    const batch = await prisma.application.findMany({
      where: { OR: [{ status: "Screened_Out", submittedAt: { lt: screenedOutCutoff } }, { submittedAt: { lt: allCutoff } }] },
      select: { id: true, resumeKey: true, documents: { select: { key: true } } },
      take: 100,
    });
    if (batch.length === 0) break;

    let deletedThisBatch = 0;
    for (const app of batch) {
      const keys = [app.resumeKey, ...app.documents.map((d) => d.key)];
      try {
        await Promise.all(keys.map((k) => deleteObject(k)));
        await prisma.application.delete({ where: { id: app.id } });
        applications += 1;
        files += keys.length;
        deletedThisBatch += 1;
      } catch (err) {
        console.error("[retention] failed to purge", app.id, err);
      }
    }
    if (deletedThisBatch === 0) break;
  }

  if (applications > 0) {
    await recordAudit({
      adminEmail: "system",
      action: "retention.purge",
      details: `Deleted ${applications} application(s) and ${files} file(s)`,
    });
  }
  return { applications, files };
}
