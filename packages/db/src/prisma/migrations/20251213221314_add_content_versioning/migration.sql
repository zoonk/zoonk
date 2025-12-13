-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('COURSE', 'CHAPTER', 'LESSON', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "ChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable: Add author_id as nullable first
ALTER TABLE "courses" ADD COLUMN "author_id" INTEGER;

-- Set author_id for existing courses to the organization owner
UPDATE "courses" c
SET "author_id" = (
  SELECT m."user_id"
  FROM "members" m
  WHERE m."organization_id" = c."organization_id" AND m."role" = 'owner'
  LIMIT 1
);

-- Make the column NOT NULL now that all rows have a value
ALTER TABLE "courses" ALTER COLUMN "author_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "content_changes" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "content_type" "ContentType" NOT NULL,
    "content_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "diff" JSONB NOT NULL,
    "author_id" INTEGER NOT NULL,
    "status" "ChangeStatus" NOT NULL DEFAULT 'PENDING',
    "reviewed_by_id" INTEGER,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_comments" (
    "id" SERIAL NOT NULL,
    "change_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "author_id" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "change_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "content_changes_content_type_content_id_idx" ON "content_changes"("content_type", "content_id");

-- CreateIndex
CREATE INDEX "content_changes_course_id_author_id_status_idx" ON "content_changes"("course_id", "author_id", "status");

-- CreateIndex
CREATE INDEX "content_changes_course_id_content_type_status_idx" ON "content_changes"("course_id", "content_type", "status");

-- CreateIndex
CREATE INDEX "content_changes_organization_id_status_idx" ON "content_changes"("organization_id", "status");

-- CreateIndex
CREATE INDEX "content_changes_author_id_idx" ON "content_changes"("author_id");

-- CreateIndex
CREATE INDEX "change_comments_change_id_idx" ON "change_comments"("change_id");

-- CreateIndex
CREATE INDEX "change_comments_parent_id_idx" ON "change_comments"("parent_id");

-- AddForeignKey
ALTER TABLE "content_changes" ADD CONSTRAINT "content_changes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_changes" ADD CONSTRAINT "content_changes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_changes" ADD CONSTRAINT "content_changes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_changes" ADD CONSTRAINT "content_changes_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_comments" ADD CONSTRAINT "change_comments_change_id_fkey" FOREIGN KEY ("change_id") REFERENCES "content_changes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_comments" ADD CONSTRAINT "change_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "change_comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_comments" ADD CONSTRAINT "change_comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
