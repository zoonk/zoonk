-- AlterEnum
ALTER TYPE "FollowUpKind" ADD VALUE 'rebuild_goal_curriculum';

-- AlterTable
ALTER TABLE "goals" ADD COLUMN     "curriculum_questions" TEXT[] DEFAULT ARRAY[]::TEXT[];
