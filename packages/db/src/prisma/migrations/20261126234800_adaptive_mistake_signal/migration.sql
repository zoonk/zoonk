-- CreateEnum
CREATE TYPE "AttemptEvidence" AS ENUM ('independent', 'guided', 'replay');

-- AlterEnum
ALTER TYPE "FollowUpKind" ADD VALUE 'write_second_take';

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "cause" "MistakeCause",
ADD COLUMN     "evidence" "AttemptEvidence";

-- AlterTable
ALTER TABLE "learner_skills" ADD COLUMN     "helped_at" TIMESTAMP(3);
