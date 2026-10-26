import { createHash, randomBytes } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./prisma";

const COOKIE = "gscs_admin";
const SESSION_HOURS = 8;

const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export async function createSession(adminId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_HOURS * 3600_000);
  await prisma.adminSession.create({ data: { adminId, tokenHash: sha256(token), expiresAt } });
  // Opportunistic cleanup of expired sessions.
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/admin",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete({ name: COOKIE, path: "/admin" });
}

export const getAdmin = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { admin: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.admin;
});

/** Call at the top of every admin page and every admin server action. */
export async function requireAdmin() {
  const admin = await getAdmin();
  if (!admin) redirect("/admin/login");
  return admin;
}
