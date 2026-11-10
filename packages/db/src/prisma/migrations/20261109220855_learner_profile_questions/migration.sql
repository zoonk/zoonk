-- CreateEnum
CREATE TYPE "ProfileQuestion" AS ENUM ('work', 'tools', 'studies', 'watch', 'listen', 'play', 'read', 'activities', 'conditions', 'learning_support');

-- CreateEnum
CREATE TYPE "ProfileAnswerOutcome" AS ENUM ('answered', 'declined');

-- CreateEnum
CREATE TYPE "LearningNeed" AS ENUM ('step_by_step', 'plain_words', 'short_answers', 'examples_first', 'shorter_days');

-- CreateEnum
CREATE TYPE "LearnerConditionKind" AS ENUM ('adhd', 'autism', 'dyslexia', 'dyscalculia', 'blind_or_low_vision', 'color_blind', 'deaf_or_hard_of_hearing', 'speech', 'motor', 'anxiety', 'other');

-- AlterTable
ALTER TABLE "memory_facts" ADD COLUMN     "profile_answer" JSONB;

-- AlterTable
ALTER TABLE "user_learning_profiles" ADD COLUMN     "learning_needs" "LearningNeed"[] DEFAULT ARRAY[]::"LearningNeed"[];

-- CreateTable
CREATE TABLE "profile_answers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "question" "ProfileQuestion" NOT NULL,
    "version" INTEGER NOT NULL,
    "outcome" "ProfileAnswerOutcome" NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profile_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_conditions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "condition" "LearnerConditionKind" NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_conditions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "profile_answers_user_id_question_key" ON "profile_answers"("user_id", "question");

-- CreateIndex
CREATE UNIQUE INDEX "learner_conditions_user_id_condition_key" ON "learner_conditions"("user_id", "condition");

-- AddForeignKey
ALTER TABLE "profile_answers" ADD CONSTRAINT "profile_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_conditions" ADD CONSTRAINT "learner_conditions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
