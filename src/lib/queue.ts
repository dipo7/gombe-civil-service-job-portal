import { Queue } from "bullmq";
import { redis } from "./redis";

export const EMAIL_QUEUE = "application-email";

export type EmailJobData = { applicationId: string };
export type EmailJobName = "send" | "confirm";

let queue: Queue<EmailJobData> | undefined;

function emailQueue(): Queue<EmailJobData> {
  if (!queue) {
    queue = new Queue<EmailJobData>(EMAIL_QUEUE, {
      connection: redis(),
      defaultJobOptions: {
        attempts: 6,
        backoff: { type: "exponential", delay: 10_000 },
        removeOnComplete: { age: 24 * 3600, count: 1000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }
  return queue;
}

const jobId = (name: EmailJobName, applicationId: string) => (name === "send" ? applicationId : `${name}-${applicationId}`);

/** Deterministic jobId makes enqueueing idempotent. */
export async function enqueueEmail(name: EmailJobName, applicationId: string): Promise<void> {
  await emailQueue().add(name, { applicationId }, { jobId: jobId(name, applicationId) });
}

export const enqueueApplicationEmail = (applicationId: string) => enqueueEmail("send", applicationId);

/** Replaces a finished or failed job so it runs again. */
export async function requeueEmail(name: EmailJobName, applicationId: string): Promise<void> {
  const existing = await emailQueue().getJob(jobId(name, applicationId));
  await existing?.remove().catch(() => undefined);
  await enqueueEmail(name, applicationId);
}
