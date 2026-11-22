-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "FollowUpKind" ADD VALUE 'prepare_level_test_bank';
ALTER TYPE "FollowUpKind" ADD VALUE 'prepare_level_test_out';
ALTER TYPE "FollowUpKind" ADD VALUE 'record_test_out_change';
ALTER TYPE "FollowUpKind" ADD VALUE 'replenish_level_test_checks';
