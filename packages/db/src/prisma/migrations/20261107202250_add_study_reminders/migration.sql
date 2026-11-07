-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('ios', 'android');

-- CreateTable
CREATE TABLE "study_reminders" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "time" VARCHAR(5) NOT NULL,
    "locale" VARCHAR(10) NOT NULL,
    "email_on" BOOLEAN NOT NULL DEFAULT false,
    "push_on" BOOLEAN NOT NULL DEFAULT false,
    "push_token" TEXT,
    "push_platform" "PushPlatform",
    "push_label" TEXT,
    "offered_at" TIMESTAMP(3),
    "enabled_at" TIMESTAMP(3),
    "processed_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_reminders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_reminders_user_id_key" ON "study_reminders"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_reminders_push_token_key" ON "study_reminders"("push_token");

-- AddForeignKey
ALTER TABLE "study_reminders" ADD CONSTRAINT "study_reminders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
