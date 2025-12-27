-- CreateTable
CREATE TABLE "lessons" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_lessons" (
    "id" SERIAL NOT NULL,
    "chapter_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "lessons_organization_id_normalized_title_idx" ON "lessons"("organization_id", "normalized_title");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_organization_id_slug_key" ON "lessons"("organization_id", "slug");

-- CreateIndex
CREATE INDEX "chapter_lessons_chapter_id_position_idx" ON "chapter_lessons"("chapter_id", "position");

-- CreateIndex
CREATE INDEX "chapter_lessons_lesson_id_idx" ON "chapter_lessons"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_lessons_chapter_id_lesson_id_key" ON "chapter_lessons"("chapter_id", "lesson_id");

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_lessons" ADD CONSTRAINT "chapter_lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_lessons" ADD CONSTRAINT "chapter_lessons_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
