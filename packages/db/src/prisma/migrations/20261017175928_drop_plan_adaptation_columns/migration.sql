/*
  Warnings:

  - You are about to drop the column `checked_input_version` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `layout_keys` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `pending_adaptation` on the `plans` table. All the data in the column will be lost.
  - You are about to drop the column `pending_pace` on the `plans` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "plans" DROP COLUMN "checked_input_version",
DROP COLUMN "layout_keys",
DROP COLUMN "pending_adaptation",
DROP COLUMN "pending_pace";

-- DropEnum
DROP TYPE "PlanAdaptationReason";
