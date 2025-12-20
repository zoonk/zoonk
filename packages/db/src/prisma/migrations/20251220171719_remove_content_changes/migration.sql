/*
  Warnings:

  - You are about to drop the `change_comments` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `content_changes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "change_comments" DROP CONSTRAINT "change_comments_author_id_fkey";

-- DropForeignKey
ALTER TABLE "change_comments" DROP CONSTRAINT "change_comments_change_id_fkey";

-- DropForeignKey
ALTER TABLE "change_comments" DROP CONSTRAINT "change_comments_parent_id_fkey";

-- DropForeignKey
ALTER TABLE "content_changes" DROP CONSTRAINT "content_changes_author_id_fkey";

-- DropForeignKey
ALTER TABLE "content_changes" DROP CONSTRAINT "content_changes_course_id_fkey";

-- DropForeignKey
ALTER TABLE "content_changes" DROP CONSTRAINT "content_changes_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "content_changes" DROP CONSTRAINT "content_changes_reviewed_by_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_author_id_fkey";

-- AlterTable
ALTER TABLE "courses" ALTER COLUMN "author_id" DROP NOT NULL;

-- DropTable
DROP TABLE "change_comments";

-- DropTable
DROP TABLE "content_changes";

-- DropEnum
DROP TYPE "ChangeStatus";

-- DropEnum
DROP TYPE "ContentType";

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
