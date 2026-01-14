/*
  Warnings:

  - The `visual_kind` column on the `steps` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "StepVisualKind" AS ENUM ('code', 'image', 'table', 'chart', 'diagram', 'timeline', 'quote', 'audio', 'video');

-- AlterTable
ALTER TABLE "steps" DROP COLUMN "visual_kind",
ADD COLUMN     "visual_kind" "StepVisualKind";
