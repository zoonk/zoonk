/*
  Warnings:

  - You are about to drop the column `author_id` on the `courses` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_author_id_fkey";

-- AlterTable
ALTER TABLE "courses" DROP COLUMN "author_id";
