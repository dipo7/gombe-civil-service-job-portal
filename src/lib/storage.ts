import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { env } from "./env";

let storage: Storage | undefined;

// Without GCS_CREDENTIALS_JSON this uses Application Default Credentials (e.g. Cloud Run service account).
// GCS_API_ENDPOINT is for the local emulator only; STORAGE_EMULATOR_HOST breaks downloads against fake-gcs-server.
function bucket() {
  if (!storage) {
    const e = env();
    storage = new Storage({
      projectId: e.GCS_PROJECT_ID || undefined,
      apiEndpoint: e.GCS_API_ENDPOINT || undefined,
      credentials: e.GCS_CREDENTIALS_JSON ? JSON.parse(e.GCS_CREDENTIALS_JSON) : undefined,
    });
  }
  return storage.bucket(env().GCS_BUCKET);
}

/** Stores the resume under a random UUID key; the original filename is never used in the key. */
export async function uploadResume(body: Buffer, extension: "pdf" | "docx", contentType: string): Promise<string> {
  const key = `resumes/${randomUUID()}.${extension}`;
  await bucket().file(key).save(body, {
    resumable: false,
    contentType,
    metadata: { contentDisposition: "attachment" },
  });
  return key;
}

export function getResumeStream(key: string): Readable {
  return bucket().file(key).createReadStream();
}

export async function resumeExists(key: string): Promise<boolean> {
  const [exists] = await bucket().file(key).exists();
  return exists;
}

/** Generic private upload for supporting documents; same UUID-key rule as resumes. */
export async function uploadDocument(body: Buffer, extension: string, contentType: string): Promise<string> {
  const key = `documents/${randomUUID()}.${extension}`;
  await bucket().file(key).save(body, {
    resumable: false,
    contentType,
    metadata: { contentDisposition: "attachment" },
  });
  return key;
}

export async function deleteObject(key: string): Promise<void> {
  await bucket().file(key).delete({ ignoreNotFound: true });
}
