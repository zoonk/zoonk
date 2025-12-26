-- CreateTable
CREATE TABLE "chapters" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_chapters" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapters_organization_id_normalized_title_idx" ON "chapters"("organization_id", "normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_organization_id_slug_key" ON "chapters"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "course_chapters_course_id_position_idx" ON "course_chapters"("course_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "course_chapters_course_id_chapter_id_key" ON "course_chapters"("course_id", "chapter_id");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
