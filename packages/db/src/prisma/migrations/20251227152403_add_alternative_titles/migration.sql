-- CreateTable
CREATE TABLE "course_alternative_titles" (
    "id" SERIAL NOT NULL,
    "course_id" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_alternative_titles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_alternative_titles_course_id_idx" ON "course_alternative_titles"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_alternative_titles_locale_slug_key" ON "course_alternative_titles"("locale", "slug");

-- AddForeignKey
ALTER TABLE "course_alternative_titles" ADD CONSTRAINT "course_alternative_titles_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
