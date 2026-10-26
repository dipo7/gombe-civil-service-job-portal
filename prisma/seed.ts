import { PrismaClient, type DegreeClass, type DegreeType } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const rule = (type: DegreeType, minClass: DegreeClass) => ({ type, minClass });

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin creation.");
    return;
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must be at least 12 characters");
  const passwordHash = await hashPassword(password);
  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash },
    create: { email, passwordHash, name: "Administrator" },
  });
  console.log(`Admin ready: ${email}`);
}

async function main() {
  await seedAdmin();
  if (await prisma.job.findFirst({ where: { id: { startsWith: "seed" } }, select: { id: true } })) {
    console.log("Sample jobs already exist; leaving them untouched.");
    return;
  }

  await prisma.job.create({
    data: {
      id: "seedadmin000001",
      title: "Administrative Officer II",
      department: "Ministry of Establishment",
      description: "Provide administrative support across the Ministry, including records, correspondence and staff welfare.",
      responsibilities: ["Prepare and maintain official correspondence", "Coordinate departmental meetings", "Maintain personnel records"],
      requirements: ["Proficiency in Microsoft Office", "Good written and spoken English"],
      hrEmail: "hr.establishment@example.gov.ng",
      minAge: 21,
      maxAge: 35,
      requireGombeOrigin: true,
      closesAt: new Date(Date.now() + 90 * 86_400_000),
      degreeRules: {
        create: [rule("UNIVERSITY", "SECOND_CLASS_LOWER"), rule("POLYTECHNIC", "UPPER_CREDIT")],
      },
    },
  });

  await prisma.job.create({
    data: {
      id: "seedteacher00001",
      title: "Primary School Teacher",
      department: "Ministry of Education",
      description: "Deliver the state primary curriculum to pupils in public schools within the assigned LGA.",
      responsibilities: ["Prepare and deliver lesson plans", "Assess and report pupil progress", "Participate in school activities"],
      requirements: ["Valid TRCN registration"],
      hrEmail: "hr.education@example.gov.ng",
      minAge: 18,
      maxAge: 40,
      requireGombeOrigin: false,
      closesAt: new Date(Date.now() + 60 * 86_400_000),
      degreeRules: {
        create: [rule("NCE", "CREDIT"), rule("UNIVERSITY", "THIRD_CLASS")],
      },
    },
  });

  await prisma.job.create({
    data: {
      id: "seedhealth000001",
      title: "Community Health Officer",
      department: "Ministry of Health",
      description: "Support primary healthcare delivery in community health centres.",
      responsibilities: ["Run immunisation and outreach programmes", "Maintain patient records", "Report disease surveillance data"],
      requirements: ["Valid professional registration"],
      hrEmail: "hr.health@example.gov.ng",
      minAge: 20,
      maxAge: 45,
      requireGombeOrigin: true,
      allowedLgas: ["Gombe", "Akko", "Kaltungo", "Billiri"],
      degreeRules: { create: [rule("POLYTECHNIC", "LOWER_CREDIT")] },
    },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
