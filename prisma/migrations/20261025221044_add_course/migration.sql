-- AlterTable: add nullable, backfill existing rows, then enforce NOT NULL
ALTER TABLE "Application" ADD COLUMN "course" TEXT;
UPDATE "Application" SET "course" = 'Not provided' WHERE "course" IS NULL;
ALTER TABLE "Application" ALTER COLUMN "course" SET NOT NULL;
