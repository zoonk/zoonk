-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "kind" VARCHAR(20) NOT NULL DEFAULT 'core';

-- CreateTable
CREATE TABLE "activities" (
    "id" SERIAL NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "lesson_id" INTEGER NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "language" VARCHAR(10) NOT NULL,
    "kind" VARCHAR(30) NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "position" INTEGER NOT NULL,
    "inventory" JSONB,
    "win_criteria" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activity_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "duration_seconds" INTEGER,
    "inventory_final" JSONB,
    "passed" BOOLEAN,

    CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_attempts" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "step_id" INTEGER NOT NULL,
    "organization_id" INTEGER NOT NULL,
    "is_correct" BOOLEAN NOT NULL,
    "answer" JSONB NOT NULL,
    "effects" JSONB,
    "duration_seconds" INTEGER NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "hour_of_day" SMALLINT NOT NULL,
    "day_of_week" SMALLINT NOT NULL,

    CONSTRAINT "step_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "current_energy" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_brain_power" BIGINT NOT NULL DEFAULT 0,
    "last_active_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_progress" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "organization_id" INTEGER,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "incorrect_answers" INTEGER NOT NULL DEFAULT 0,
    "static_completed" INTEGER NOT NULL DEFAULT 0,
    "interactive_completed" INTEGER NOT NULL DEFAULT 0,
    "challenges_completed" INTEGER NOT NULL DEFAULT 0,
    "brain_power_earned" INTEGER NOT NULL DEFAULT 0,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "energy_at_end" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "daily_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" SERIAL NOT NULL,
    "activity_id" INTEGER NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "position" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "visual_kind" VARCHAR(20),
    "visual_content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_lesson_id_position_idx" ON "activities"("lesson_id", "position");

-- CreateIndex
CREATE INDEX "activities_organization_id_kind_idx" ON "activities"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "activity_progress_user_id_idx" ON "activity_progress"("user_id");

-- CreateIndex
CREATE INDEX "activity_progress_activity_id_idx" ON "activity_progress"("activity_id");

-- CreateIndex
CREATE UNIQUE INDEX "activity_progress_user_id_activity_id_key" ON "activity_progress"("user_id", "activity_id");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_answered_at_idx" ON "step_attempts"("user_id", "answered_at");

-- CreateIndex
CREATE INDEX "step_attempts_step_id_idx" ON "step_attempts"("step_id");

-- CreateIndex
CREATE INDEX "step_attempts_organization_id_idx" ON "step_attempts"("organization_id");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_organization_id_idx" ON "step_attempts"("user_id", "organization_id");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_day_of_week_idx" ON "step_attempts"("user_id", "day_of_week");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_hour_of_day_idx" ON "step_attempts"("user_id", "hour_of_day");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_key" ON "user_progress"("user_id");

-- CreateIndex
CREATE INDEX "daily_progress_user_id_date_idx" ON "daily_progress"("user_id", "date");

-- CreateIndex
CREATE INDEX "daily_progress_organization_id_idx" ON "daily_progress"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_user_id_date_organization_id_key" ON "daily_progress"("user_id", "date", "organization_id");

-- CreateIndex
CREATE INDEX "steps_activity_id_position_idx" ON "steps"("activity_id", "position");

-- CreateIndex
CREATE INDEX "lessons_organization_id_kind_idx" ON "lessons"("organization_id", "kind");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
