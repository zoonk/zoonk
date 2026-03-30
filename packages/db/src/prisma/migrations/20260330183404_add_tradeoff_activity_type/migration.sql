-- AlterEnum
ALTER TYPE "ActivityKind" ADD VALUE 'tradeoff';

-- AlterEnum
ALTER TYPE "StepKind" ADD VALUE 'tradeoff';

-- AlterTable
ALTER TABLE "daily_progress" ADD COLUMN     "tradeoff_completed" INTEGER NOT NULL DEFAULT 0;
