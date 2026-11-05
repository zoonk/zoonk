-- AlterTable
ALTER TABLE "library_steps" ADD COLUMN     "marks" JSONB;

-- CreateTable
CREATE TABLE "lesson_icons" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "name" TEXT NOT NULL,
    "tags" TEXT[],
    "description" TEXT NOT NULL,
    "status" "GenerationStatus" NOT NULL DEFAULT 'running',
    "run_id" TEXT NOT NULL,
    "url" TEXT,
    "small_url" TEXT,
    "style_version" SMALLINT NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_icons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_icons_name_key" ON "lesson_icons"("name");

-- Prisma can't declare an expression index; core's LESSON_ICON_DOCUMENT must match it exactly.
CREATE INDEX "lesson_icons_search_idx" ON "lesson_icons" USING gin (library_search_vector('en'::text, (ARRAY["name"] || "tags"))) WHERE "status" = 'completed';
