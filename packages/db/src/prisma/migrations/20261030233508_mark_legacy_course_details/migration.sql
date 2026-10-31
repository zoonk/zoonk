-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "legacy_details" BOOLEAN NOT NULL DEFAULT false;

-- Courses kept from before learning v2 are the only ones the cutover left without an outline status.
UPDATE "courses" SET "legacy_details" = true WHERE "outline_status" IS NULL;
