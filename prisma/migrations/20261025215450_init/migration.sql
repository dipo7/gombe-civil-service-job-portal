-- CreateEnum
CREATE TYPE "DegreeType" AS ENUM ('UNIVERSITY', 'POLYTECHNIC', 'NCE');

-- CreateEnum
CREATE TYPE "DegreeClass" AS ENUM ('FIRST_CLASS', 'SECOND_CLASS_UPPER', 'SECOND_CLASS_LOWER', 'THIRD_CLASS', 'PASS', 'DISTINCTION', 'UPPER_CREDIT', 'LOWER_CREDIT', 'CREDIT', 'MERIT');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('Pending', 'Screened_In', 'Screened_Out');

-- CreateEnum
CREATE TYPE "DispatchStatus" AS ENUM ('NotQueued', 'Queued', 'Sent', 'Failed');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "responsibilities" TEXT[],
    "requirements" TEXT[],
    "location" TEXT NOT NULL DEFAULT 'Gombe, Gombe State',
    "isOpen" BOOLEAN NOT NULL DEFAULT true,
    "closesAt" TIMESTAMP(3),
    "hrEmail" TEXT NOT NULL,
    "minAge" INTEGER,
    "maxAge" INTEGER,
    "requireGombeOrigin" BOOLEAN NOT NULL DEFAULT false,
    "allowedLgas" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDegreeRule" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "DegreeType" NOT NULL,
    "minClass" "DegreeClass" NOT NULL,

    CONSTRAINT "JobDegreeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "stateOfOrigin" TEXT NOT NULL,
    "lga" TEXT,
    "dateOfBirth" DATE NOT NULL,
    "degreeType" "DegreeType" NOT NULL,
    "degreeClass" "DegreeClass" NOT NULL,
    "institution" TEXT NOT NULL,
    "graduationYear" INTEGER NOT NULL,
    "resumeKey" TEXT NOT NULL,
    "resumeFileName" TEXT NOT NULL,
    "resumeMime" TEXT NOT NULL,
    "resumeSize" INTEGER NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'Pending',
    "screeningNotes" TEXT[],
    "dispatchStatus" "DispatchStatus" NOT NULL DEFAULT 'NotQueued',
    "dispatchedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSession" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_isOpen_department_idx" ON "Job"("isOpen", "department");

-- CreateIndex
CREATE UNIQUE INDEX "JobDegreeRule_jobId_type_key" ON "JobDegreeRule"("jobId", "type");

-- CreateIndex
CREATE INDEX "Application_jobId_status_idx" ON "Application"("jobId", "status");

-- CreateIndex
CREATE INDEX "Application_status_idx" ON "Application"("status");

-- CreateIndex
CREATE INDEX "Application_dispatchStatus_idx" ON "Application"("dispatchStatus");

-- CreateIndex
CREATE UNIQUE INDEX "Application_jobId_email_key" ON "Application"("jobId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");

-- CreateIndex
CREATE INDEX "AdminSession_adminId_idx" ON "AdminSession"("adminId");

-- CreateIndex
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDegreeRule" ADD CONSTRAINT "JobDegreeRule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
