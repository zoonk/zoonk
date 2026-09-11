-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "family_id" UUID;

-- CreateTable
CREATE TABLE "course_families" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_edition_requests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_course_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "course_prompt_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_edition_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_edition_requests_course_prompt_id_idx" ON "course_edition_requests"("course_prompt_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_edition_requests_source_course_id_language_key" ON "course_edition_requests"("source_course_id", "language");

-- CreateIndex
CREATE INDEX "courses_family_id_language_idx" ON "courses"("family_id", "language");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "course_families"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_edition_requests" ADD CONSTRAINT "course_edition_requests_source_course_id_fkey" FOREIGN KEY ("source_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_edition_requests" ADD CONSTRAINT "course_edition_requests_course_prompt_id_fkey" FOREIGN KEY ("course_prompt_id") REFERENCES "course_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
