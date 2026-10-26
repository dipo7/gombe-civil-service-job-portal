import { cache } from "react";
import { prisma } from "./prisma";
import { jobIdSchema } from "./validation";

/** Public-safe job view. Never selects hrEmail. */
export const getPublicJob = cache(async (id: string) => {
  if (!jobIdSchema.safeParse(id).success) return null;
  const job = await prisma.job.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      department: true,
      description: true,
      responsibilities: true,
      requirements: true,
      location: true,
      isOpen: true,
      closesAt: true,
      minAge: true,
      maxAge: true,
      requireGombeOrigin: true,
      allowedLgas: true,
      degreeRules: { select: { type: true, minClass: true } },
    },
  });
  if (!job) return null;
  return { ...job, accepting: job.isOpen && (!job.closesAt || job.closesAt > new Date()) };
});
