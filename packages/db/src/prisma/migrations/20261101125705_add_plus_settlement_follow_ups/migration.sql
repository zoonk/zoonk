-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FollowUpKind" ADD VALUE 'end_web_plus_beside_store';
ALTER TYPE "FollowUpKind" ADD VALUE 'ask_to_cancel_second_store_plus';
