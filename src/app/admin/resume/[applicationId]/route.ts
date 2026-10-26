import { Readable } from "node:stream";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResumeStream, resumeExists } from "@/lib/storage";
import { jobIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

// Admin-only: resumes are never public; the bucket stays private and is proxied through here.
export async function GET(_req: Request, { params }: { params: Promise<{ applicationId: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { applicationId } = await params;
  if (!jobIdSchema.safeParse(applicationId).success) return new Response("Not found", { status: 404 });

  const app = await prisma.application.findUnique({
    where: { id: applicationId },
    select: { resumeKey: true, resumeFileName: true, resumeMime: true },
  });
  if (!app || !(await resumeExists(app.resumeKey))) return new Response("Not found", { status: 404 });

  await audit(admin, "resume.download", { type: "Application", id: applicationId });

  const body = Readable.toWeb(getResumeStream(app.resumeKey)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": app.resumeMime,
      "Content-Disposition": `attachment; filename="${app.resumeFileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
