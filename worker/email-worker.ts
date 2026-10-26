import { Worker, type Job as BullJob } from "bullmq";
import { env } from "../src/lib/env";
import { prisma } from "../src/lib/prisma";
import { redis } from "../src/lib/redis";
import { closeMailer, sendMail } from "../src/lib/mailer";
import { getResumeStream } from "../src/lib/storage";
import { buildApplicationEmail, buildConfirmationEmail } from "../src/lib/email-template";
import { EMAIL_QUEUE, enqueueEmail, type EmailJobData } from "../src/lib/queue";
import { purgeExpired } from "../src/lib/retention";

const e = env();

async function sendToHr(applicationId: string) {
  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { job: true, documents: { select: { type: true } } },
  });
  if (!app) return;
  // Only screened-in, not-yet-sent applications are ever dispatched.
  if (app.status !== "Screened_In" || app.dispatchStatus === "Sent") return;

  const { subject, html, text } = buildApplicationEmail(app, app.job, e.APP_URL);
  await sendMail({
    to: app.job.hrEmail,
    replyTo: { name: app.fullName.replace(/["<>]/g, ""), address: app.email },
    subject,
    html,
    text,
    attachments: [{ filename: app.resumeFileName, content: getResumeStream(app.resumeKey), contentType: app.resumeMime }],
  });

  await prisma.application.update({ where: { id: app.id }, data: { dispatchStatus: "Sent", dispatchedAt: new Date() } });
}

async function sendConfirmation(applicationId: string) {
  const app = await prisma.application.findUnique({ where: { id: applicationId }, include: { job: { select: { title: true } } } });
  if (!app || app.confirmationSentAt) return;

  const { subject, html, text } = buildConfirmationEmail(app, app.job);
  await sendMail({ to: app.email, subject, html, text });
  await prisma.application.update({ where: { id: app.id }, data: { confirmationSentAt: new Date() } });
}

async function handle(job: BullJob<EmailJobData>) {
  if (job.name === "confirm") return sendConfirmation(job.data.applicationId);
  return sendToHr(job.data.applicationId);
}

const worker = new Worker<EmailJobData>(EMAIL_QUEUE, handle, {
  connection: redis(),
  concurrency: 5,
  limiter: { max: 10, duration: 1000 },
});

worker.on("completed", (job) => console.log(`[email] ${job.name} done ${job.data.applicationId}`));
worker.on("failed", async (job, err) => {
  if (!job) return;
  console.error(`[email] ${job.name} attempt ${job.attemptsMade} failed for ${job.data.applicationId}:`, err.message);
  if (job.name === "send" && job.attemptsMade >= (job.opts.attempts ?? 1)) {
    await prisma.application
      .update({ where: { id: job.data.applicationId }, data: { dispatchStatus: "Failed" } })
      .catch(() => undefined);
  }
});

// Recovers work whose enqueue failed in the web request.
async function sweep() {
  const orphans = await prisma.application.findMany({
    where: { status: "Screened_In", dispatchStatus: "NotQueued" },
    select: { id: true },
    take: 100,
  });
  for (const { id } of orphans) {
    try {
      await enqueueEmail("send", id);
      await prisma.application.update({ where: { id }, data: { dispatchStatus: "Queued" } });
    } catch (err) {
      console.error("[email] sweep failed for", id, err);
    }
  }

  const unconfirmed = await prisma.application.findMany({
    where: { confirmationSentAt: null, submittedAt: { lt: new Date(Date.now() - 2 * 60_000) } },
    select: { id: true },
    take: 100,
  });
  for (const { id } of unconfirmed) await enqueueEmail("confirm", id).catch(() => undefined);
}

async function retention() {
  try {
    const r = await purgeExpired();
    if (r.applications > 0) console.log(`[retention] purged ${r.applications} application(s), ${r.files} file(s)`);
  } catch (err) {
    console.error("[retention] failed", err);
  }
}

void sweep();
void retention();
const sweepTimer = setInterval(() => void sweep(), 5 * 60 * 1000);
const retentionTimer = setInterval(() => void retention(), 24 * 3600 * 1000);

async function shutdown() {
  clearInterval(sweepTimer);
  clearInterval(retentionTimer);
  await worker.close();
  closeMailer();
  await prisma.$disconnect();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log("[email] worker started");
