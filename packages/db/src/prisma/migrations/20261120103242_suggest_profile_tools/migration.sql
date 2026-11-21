-- AlterEnum
ALTER TYPE "FollowUpKind" ADD VALUE 'suggest_profile_tools';

-- AlterTable
ALTER TABLE "user_learning_profiles" ADD COLUMN     "suggested_tools" TEXT[] DEFAULT ARRAY[]::TEXT[];
