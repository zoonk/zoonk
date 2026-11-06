-- AlterTable
ALTER TABLE "media_assets" DROP COLUMN "check_attempts",
ADD COLUMN     "check_failures" INTEGER NOT NULL DEFAULT 0;

