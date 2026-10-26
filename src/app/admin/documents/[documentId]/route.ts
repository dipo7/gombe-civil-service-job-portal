import { Readable } from "node:stream";
import { audit } from "@/lib/audit";
import { getAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getResumeStream, resumeExists } from "@/lib/storage";
import { jobIdSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const admin = await getAdmin();
  if (!admin) return new Response("Unauthorized", { status: 401 });

  const { documentId } = await params;
  if (!jobIdSchema.safeParse(documentId).success) return new Response("Not found", { status: 404 });

  const doc = await prisma.applicationDocument.findUnique({
    where: { id: documentId },
    select: { key: true, fileName: true, mime: true, type: true, applicationId: true },
  });
  if (!doc || !(await resumeExists(doc.key))) return new Response("Not found", { status: 404 });

  await audit(admin, "document.download", { type: "Application", id: doc.applicationId }, doc.type);

  const body = Readable.toWeb(getResumeStream(doc.key)) as ReadableStream;
  return new Response(body, {
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${doc.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
