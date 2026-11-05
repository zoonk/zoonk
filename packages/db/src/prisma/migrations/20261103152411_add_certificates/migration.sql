-- CreateEnum
CREATE TYPE "CertificateKind" AS ENUM ('course', 'language_level', 'placement');

-- AlterTable
ALTER TABLE "language_skill_levels" ADD COLUMN     "raised_at" TIMESTAMP(3);

-- Skills already above their start count from launch.
UPDATE "language_skill_levels" SET "raised_at" = "updated_at" WHERE "score" > "start_score";

-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "CertificateKind" NOT NULL,
    "key" TEXT NOT NULL,
    "code" VARCHAR(12) NOT NULL,
    "goal_id" UUID,
    "course_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10),
    "level" VARCHAR(2),
    "title" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "completed_on" DATE NOT NULL,
    "shown_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE INDEX "certificates_goal_id_idx" ON "certificates"("goal_id");

-- CreateIndex
CREATE INDEX "certificates_course_id_idx" ON "certificates"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_user_id_kind_key_key" ON "certificates"("user_id", "kind", "key");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
