/*
  Warnings:

  - You are about to drop the column `management_mode` on the `activities` table. All the data in the column will be lost.
  - You are about to drop the column `management_mode` on the `chapters` table. All the data in the column will be lost.
  - You are about to drop the column `management_mode` on the `courses` table. All the data in the column will be lost.
  - You are about to drop the column `generation_version` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `is_regenerating` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `management_mode` on the `lessons` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "activities" DROP COLUMN "management_mode";

-- AlterTable
ALTER TABLE "chapters" DROP COLUMN "management_mode";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "management_mode";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "generation_version",
DROP COLUMN "is_regenerating",
DROP COLUMN "management_mode";

-- DropEnum
DROP TYPE "ContentManagementMode";
