-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ContentFixUnit" ADD VALUE 'skill';
ALTER TYPE "ContentFixUnit" ADD VALUE 'warm_up';
ALTER TYPE "ContentFixUnit" ADD VALUE 'source';
ALTER TYPE "ContentFixUnit" ADD VALUE 'media_asset';
ALTER TYPE "ContentFixUnit" ADD VALUE 'exam_blueprint';
ALTER TYPE "ContentFixUnit" ADD VALUE 'item_set';
