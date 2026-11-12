-- CreateTable
CREATE TABLE "library_lesson_sources" (
    "lesson_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "articles" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_lesson_sources_pkey" PRIMARY KEY ("lesson_id","source_id")
);

-- CreateTable
CREATE TABLE "law_lookups" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "country" VARCHAR(2) NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "name" TEXT NOT NULL,
    "source_id" UUID,
    "checked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "law_lookups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "library_lesson_sources_source_id_idx" ON "library_lesson_sources"("source_id");

-- CreateIndex
CREATE INDEX "law_lookups_source_id_idx" ON "law_lookups"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "law_lookups_country_language_name_key" ON "law_lookups"("country", "language", "name");

-- AddForeignKey
ALTER TABLE "library_lesson_sources" ADD CONSTRAINT "library_lesson_sources_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_lesson_sources" ADD CONSTRAINT "library_lesson_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "law_lookups" ADD CONSTRAINT "law_lookups_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;
