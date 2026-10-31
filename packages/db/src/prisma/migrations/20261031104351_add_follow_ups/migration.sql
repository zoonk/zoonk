-- CreateEnum
CREATE TYPE "FollowUpKind" AS ENUM ('prepare_session', 'prepare_goal_lessons', 'write_lesson', 'classify_mistake_cause', 'find_mistake_pattern', 'remember_onboarding', 'remember_session', 'check_daily_insight', 'check_fact_sensitivity', 'voice_word');

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "FollowUpKind" NOT NULL,
    "key" TEXT NOT NULL,
    "input" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "follow_ups_requested_at_idx" ON "follow_ups"("requested_at");

-- CreateIndex
CREATE UNIQUE INDEX "follow_ups_user_id_kind_key_key" ON "follow_ups"("user_id", "kind", "key");

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
