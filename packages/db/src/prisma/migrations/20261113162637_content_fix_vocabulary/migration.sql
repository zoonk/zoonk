-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentFixUnit" ADD VALUE 'word';
ALTER TYPE "ContentFixUnit" ADD VALUE 'sentence';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FollowUpKind" ADD VALUE 'voice_content_fix';
ALTER TYPE "FollowUpKind" ADD VALUE 'write_sentence_orders';

-- AlterTable
ALTER TABLE "content_fixes" ADD COLUMN     "voice" JSONB,
ADD COLUMN     "voice_owed_at" TIMESTAMP(3);
