/*
  Warnings:

  - You are about to drop the column `inventory` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `win_criteria` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `inventory_final` on the `activity_progress` table. All the data in the column will be lost.
  - You are about to drop the column `passed` on the `activity_progress` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "activities" DROP COLUMN "inventory",
DROP COLUMN "win_criteria",
ADD COLUMN     "content" JSONB;

-- AlterTable
ALTER TABLE "activity_progress" DROP COLUMN "inventory_final",
DROP COLUMN "passed";
