/*
  Warnings:

  - You are about to drop the column `visual_content` on the `steps` table. All the data in the column will be lost.
  - You are about to drop the column `visual_kind` on the `steps` table. All the data in the column will be lost.

*/
-- AlterEnum
ALTER TYPE "StepKind" ADD VALUE 'visual';

-- AlterTable
ALTER TABLE "steps" DROP COLUMN "visual_content",
DROP COLUMN "visual_kind";

-- DropEnum
DROP TYPE "StepVisualKind";
