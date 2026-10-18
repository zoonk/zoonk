-- CreateEnum
CREATE TYPE "PlanAdaptationReason" AS ENUM ('content', 'goal_source', 'calendar', 'pace', 'evidence', 'account', 'rebalance');

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "checked_input_version" INTEGER,
ADD COLUMN     "layout_keys" JSONB,
ADD COLUMN     "pending_adaptation" "PlanAdaptationReason"[] DEFAULT ARRAY[]::"PlanAdaptationReason"[],
ADD COLUMN     "pending_pace" JSONB;
