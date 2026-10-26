-- CreateEnum
CREATE TYPE "HrDecision" AS ENUM ('Undecided', 'Shortlisted', 'Rejected');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('DegreeCertificate', 'NyscCertificate', 'OriginLetter');

-- DropIndex
DROP INDEX "Application_jobId_email_key";

-- AlterTable: new required columns are added nullable, backfilled, then made NOT NULL
ALTER TABLE "Application" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "consentAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT,
ADD COLUMN     "declarationAt" TIMESTAMP(3),
ADD COLUMN     "emailCanonical" TEXT,
ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "hrDecidedAt" TIMESTAMP(3),
ADD COLUMN     "hrDecidedByEmail" TEXT,
ADD COLUMN     "hrDecision" "HrDecision" NOT NULL DEFAULT 'Undecided',
ADD COLUMN     "phoneNormalized" TEXT,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "screeningOverriddenAt" TIMESTAMP(3),
ADD COLUMN     "screeningOverriddenBy" TEXT;

UPDATE "Application" SET
  "consentAt" = "submittedAt",
  "consentVersion" = 'legacy',
  "declarationAt" = "submittedAt",
  "emailVerifiedAt" = "submittedAt",
  "emailCanonical" = lower("email") || '#' || "id",
  "phoneNormalized" = CASE WHEN "phone" LIKE '0%' THEN '+234' || substr("phone", 2) ELSE "phone" END || '#' || "id",
  "reference" = 'GSC-' || upper(substr(md5("id"), 1, 8));

ALTER TABLE "Application"
  ALTER COLUMN "consentAt" SET NOT NULL,
  ALTER COLUMN "consentVersion" SET NOT NULL,
  ALTER COLUMN "declarationAt" SET NOT NULL,
  ALTER COLUMN "emailCanonical" SET NOT NULL,
  ALTER COLUMN "emailVerifiedAt" SET NOT NULL,
  ALTER COLUMN "phoneNormalized" SET NOT NULL,
  ALTER COLUMN "reference" SET NOT NULL;

-- CreateTable
CREATE TABLE "ApplicationDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "key" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "size" INTEGER NOT NULL,

    CONSTRAINT "ApplicationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminEmail" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationDocument_applicationId_type_key" ON "ApplicationDocument"("applicationId", "type");

-- CreateIndex
CREATE INDEX "ApplicationNote_applicationId_idx" ON "ApplicationNote"("applicationId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Application_reference_key" ON "Application"("reference");

-- CreateIndex
CREATE INDEX "Application_jobId_hrDecision_idx" ON "Application"("jobId", "hrDecision");

-- CreateIndex
CREATE INDEX "Application_submittedAt_idx" ON "Application"("submittedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_emailCanonical_key" ON "Application"("jobId", "emailCanonical");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_phoneNormalized_key" ON "Application"("jobId", "phoneNormalized");

-- AddForeignKey
ALTER TABLE "ApplicationDocument" ADD CONSTRAINT "ApplicationDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationNote" ADD CONSTRAINT "ApplicationNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
