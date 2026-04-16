/*
  Warnings:

  - The primary key for the `accounts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `accounts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `activities` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `activities` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `organization_id` column on the `activities` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `activity_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `activity_progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `chapter_completions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `chapter_completions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `chapters` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `chapters` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `organization_id` column on the `chapters` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `content_reviews` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `content_reviews` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `course_alternative_titles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `course_alternative_titles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `course_categories` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `course_categories` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `course_completions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `course_completions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `course_suggestions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `course_suggestions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `course_users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `course_users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `courses` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `courses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `organization_id` column on the `courses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `user_id` column on the `courses` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `daily_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `daily_progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `invitations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `invitations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `jwks` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `jwks` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `lesson_completions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `lesson_completions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `lesson_sentences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `lesson_sentences` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `lesson_words` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `lesson_words` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `lessons` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `lessons` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `organization_id` column on the `lessons` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `members` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `members` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `organizations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `organizations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `rate_limits` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `rate_limits` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `search_prompt_suggestions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `search_prompt_suggestions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `search_prompts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `search_prompts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `sentences` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `sentences` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `sessions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `impersonated_by` column on the `sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `active_organization_id` column on the `sessions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `step_attempts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `step_attempts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `steps` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `steps` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `sentence_id` column on the `steps` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `word_id` column on the `steps` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `subscriptions` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `subscriptions` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_learning_profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `user_learning_profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_progress` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `user_progress` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `users` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `verifications` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `verifications` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `word_pronunciations` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `word_pronunciations` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `words` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `words` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `user_id` on the `accounts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lesson_id` on the `activities` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `activity_progress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `activity_id` on the `activity_progress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `chapter_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `chapter_id` on the `chapter_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_id` on the `chapters` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `entity_id` on the `content_reviews` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `content_reviews` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_id` on the `course_alternative_titles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_id` on the `course_categories` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `course_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_id` on the `course_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_id` on the `course_users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `course_users` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `daily_progress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `organization_id` on the `invitations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `inviter_id` on the `invitations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `lesson_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lesson_id` on the `lesson_completions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lesson_id` on the `lesson_sentences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `sentence_id` on the `lesson_sentences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `lesson_id` on the `lesson_words` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `word_id` on the `lesson_words` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `chapter_id` on the `lessons` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `organization_id` on the `members` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `members` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `search_prompt_id` on the `search_prompt_suggestions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `course_suggestion_id` on the `search_prompt_suggestions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `organization_id` on the `sentences` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `sessions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `step_attempts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `step_id` on the `step_attempts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `activity_id` on the `steps` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `reference_id` on the `subscriptions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_learning_profiles` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `user_id` on the `user_progress` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `word_id` on the `word_pronunciations` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `organization_id` on the `words` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "activities" DROP CONSTRAINT "activities_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_course_id_fkey";

-- DropForeignKey
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "content_reviews" DROP CONSTRAINT "content_reviews_user_id_fkey";

-- DropForeignKey
ALTER TABLE "course_alternative_titles" DROP CONSTRAINT "course_alternative_titles_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_categories" DROP CONSTRAINT "course_categories_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "course_users" DROP CONSTRAINT "course_users_course_id_fkey";

-- DropForeignKey
ALTER TABLE "course_users" DROP CONSTRAINT "course_users_user_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "courses" DROP CONSTRAINT "courses_user_id_fkey";

-- DropForeignKey
ALTER TABLE "daily_progress" DROP CONSTRAINT "daily_progress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_inviter_id_fkey";

-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_sentences" DROP CONSTRAINT "lesson_sentences_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_sentences" DROP CONSTRAINT "lesson_sentences_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_words" DROP CONSTRAINT "lesson_words_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "lesson_words" DROP CONSTRAINT "lesson_words_word_id_fkey";

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_chapter_id_fkey";

-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "members" DROP CONSTRAINT "members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "search_prompt_suggestions" DROP CONSTRAINT "search_prompt_suggestions_course_suggestion_id_fkey";

-- DropForeignKey
ALTER TABLE "search_prompt_suggestions" DROP CONSTRAINT "search_prompt_suggestions_search_prompt_id_fkey";

-- DropForeignKey
ALTER TABLE "sentences" DROP CONSTRAINT "sentences_organization_id_fkey";

-- DropForeignKey
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_user_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_step_id_fkey";

-- DropForeignKey
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_user_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_activity_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_sentence_id_fkey";

-- DropForeignKey
ALTER TABLE "steps" DROP CONSTRAINT "steps_word_id_fkey";

-- DropForeignKey
ALTER TABLE "user_learning_profiles" DROP CONSTRAINT "user_learning_profiles_user_id_fkey";

-- DropForeignKey
ALTER TABLE "user_progress" DROP CONSTRAINT "user_progress_user_id_fkey";

-- DropForeignKey
ALTER TABLE "word_pronunciations" DROP CONSTRAINT "word_pronunciations_word_id_fkey";

-- DropForeignKey
ALTER TABLE "words" DROP CONSTRAINT "words_organization_id_fkey";

-- AlterTable
ALTER TABLE "accounts" DROP CONSTRAINT "accounts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "accounts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "activities" DROP CONSTRAINT "activities_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID,
DROP COLUMN "lesson_id",
ADD COLUMN     "lesson_id" UUID NOT NULL,
ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "activity_progress" DROP CONSTRAINT "activity_progress_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "activity_id",
ADD COLUMN     "activity_id" UUID NOT NULL,
ADD CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "chapter_completions" DROP CONSTRAINT "chapter_completions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "chapter_id",
ADD COLUMN     "chapter_id" UUID NOT NULL,
ADD CONSTRAINT "chapter_completions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID,
DROP COLUMN "course_id",
ADD COLUMN     "course_id" UUID NOT NULL,
ADD CONSTRAINT "chapters_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "content_reviews" DROP CONSTRAINT "content_reviews_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "entity_id",
ADD COLUMN     "entity_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "content_reviews_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "course_alternative_titles" DROP CONSTRAINT "course_alternative_titles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "course_id",
ADD COLUMN     "course_id" UUID NOT NULL,
ADD CONSTRAINT "course_alternative_titles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "course_categories" DROP CONSTRAINT "course_categories_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "course_id",
ADD COLUMN     "course_id" UUID NOT NULL,
ADD CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "course_completions" DROP CONSTRAINT "course_completions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "course_id",
ADD COLUMN     "course_id" UUID NOT NULL,
ADD CONSTRAINT "course_completions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "course_suggestions" DROP CONSTRAINT "course_suggestions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "course_suggestions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "course_users" DROP CONSTRAINT "course_users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "course_id",
ADD COLUMN     "course_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "course_users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "courses" DROP CONSTRAINT "courses_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID,
ADD CONSTRAINT "courses_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "daily_progress" DROP CONSTRAINT "daily_progress_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "daily_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID NOT NULL,
DROP COLUMN "inviter_id",
ADD COLUMN     "inviter_id" UUID NOT NULL,
ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "jwks" DROP CONSTRAINT "jwks_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "jwks_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lesson_completions" DROP CONSTRAINT "lesson_completions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "lesson_id",
ADD COLUMN     "lesson_id" UUID NOT NULL,
ADD CONSTRAINT "lesson_completions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lesson_sentences" DROP CONSTRAINT "lesson_sentences_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "lesson_id",
ADD COLUMN     "lesson_id" UUID NOT NULL,
DROP COLUMN "sentence_id",
ADD COLUMN     "sentence_id" UUID NOT NULL,
ADD CONSTRAINT "lesson_sentences_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lesson_words" DROP CONSTRAINT "lesson_words_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "lesson_id",
ADD COLUMN     "lesson_id" UUID NOT NULL,
DROP COLUMN "word_id",
ADD COLUMN     "word_id" UUID NOT NULL,
ADD CONSTRAINT "lesson_words_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID,
DROP COLUMN "chapter_id",
ADD COLUMN     "chapter_id" UUID NOT NULL,
ADD CONSTRAINT "lessons_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "members" DROP CONSTRAINT "members_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID NOT NULL,
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "members_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "organizations" DROP CONSTRAINT "organizations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "organizations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "rate_limits" DROP CONSTRAINT "rate_limits_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "search_prompt_suggestions" DROP CONSTRAINT "search_prompt_suggestions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "search_prompt_id",
ADD COLUMN     "search_prompt_id" UUID NOT NULL,
DROP COLUMN "course_suggestion_id",
ADD COLUMN     "course_suggestion_id" UUID NOT NULL,
ADD CONSTRAINT "search_prompt_suggestions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "search_prompts" DROP CONSTRAINT "search_prompts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "search_prompts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sentences" DROP CONSTRAINT "sentences_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD CONSTRAINT "sentences_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sessions" DROP CONSTRAINT "sessions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "impersonated_by",
ADD COLUMN     "impersonated_by" UUID,
DROP COLUMN "active_organization_id",
ADD COLUMN     "active_organization_id" UUID,
ADD CONSTRAINT "sessions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "step_attempts" DROP CONSTRAINT "step_attempts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
DROP COLUMN "step_id",
ADD COLUMN     "step_id" UUID NOT NULL,
ADD CONSTRAINT "step_attempts_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "steps" DROP CONSTRAINT "steps_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "activity_id",
ADD COLUMN     "activity_id" UUID NOT NULL,
DROP COLUMN "sentence_id",
ADD COLUMN     "sentence_id" UUID,
DROP COLUMN "word_id",
ADD COLUMN     "word_id" UUID,
ADD CONSTRAINT "steps_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "subscriptions" DROP CONSTRAINT "subscriptions_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "reference_id",
ADD COLUMN     "reference_id" UUID NOT NULL,
ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_learning_profiles" DROP CONSTRAINT "user_learning_profiles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_learning_profiles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_progress" DROP CONSTRAINT "user_progress_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "user_id",
ADD COLUMN     "user_id" UUID NOT NULL,
ADD CONSTRAINT "user_progress_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "users" DROP CONSTRAINT "users_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "verifications" DROP CONSTRAINT "verifications_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
ADD CONSTRAINT "verifications_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "word_pronunciations" DROP CONSTRAINT "word_pronunciations_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "word_id",
ADD COLUMN     "word_id" UUID NOT NULL,
ADD CONSTRAINT "word_pronunciations_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "words" DROP CONSTRAINT "words_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT uuidv7(),
DROP COLUMN "organization_id",
ADD COLUMN     "organization_id" UUID NOT NULL,
ADD CONSTRAINT "words_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "accounts_user_id_idx" ON "accounts"("user_id");

-- CreateIndex
CREATE INDEX "activities_lesson_id_archived_at_position_idx" ON "activities"("lesson_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "activities_lesson_id_archived_at_generation_status_idx" ON "activities"("lesson_id", "archived_at", "generation_status");

-- CreateIndex
CREATE INDEX "activities_organization_id_kind_idx" ON "activities"("organization_id", "kind");

-- CreateIndex
CREATE INDEX "activity_progress_activity_id_idx" ON "activity_progress"("activity_id");

-- CreateIndex
CREATE INDEX "activity_progress_user_id_completed_at_idx" ON "activity_progress"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "activity_progress_user_id_activity_id_key" ON "activity_progress"("user_id", "activity_id");

-- CreateIndex
CREATE INDEX "chapter_completions_chapter_id_idx" ON "chapter_completions"("chapter_id");

-- CreateIndex
CREATE INDEX "chapter_completions_user_id_completed_at_idx" ON "chapter_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_completions_user_id_chapter_id_key" ON "chapter_completions"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "chapters_organization_id_archived_at_normalized_title_idx" ON "chapters"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "chapters_course_id_archived_at_position_idx" ON "chapters"("course_id", "archived_at", "position");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_course_id_slug_key" ON "chapters"("course_id", "slug");

-- CreateIndex
CREATE INDEX "content_reviews_user_id_idx" ON "content_reviews"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reviews_task_type_entity_id_key" ON "content_reviews"("task_type", "entity_id");

-- CreateIndex
CREATE INDEX "course_alternative_titles_course_id_idx" ON "course_alternative_titles"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_course_id_category_key" ON "course_categories"("course_id", "category");

-- CreateIndex
CREATE INDEX "course_completions_course_id_idx" ON "course_completions"("course_id");

-- CreateIndex
CREATE INDEX "course_completions_user_id_completed_at_idx" ON "course_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "course_completions_user_id_course_id_key" ON "course_completions"("user_id", "course_id");

-- CreateIndex
CREATE INDEX "course_users_user_id_idx" ON "course_users"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_users_course_id_user_id_key" ON "course_users"("course_id", "user_id");

-- CreateIndex
CREATE INDEX "courses_organization_id_archived_at_normalized_title_idx" ON "courses"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "courses_organization_id_is_published_archived_at_created_at_idx" ON "courses"("organization_id", "is_published", "archived_at", "created_at");

-- CreateIndex
CREATE INDEX "courses_is_published_archived_at_language_user_count_id_idx" ON "courses"("is_published", "archived_at", "language", "user_count", "id");

-- CreateIndex
CREATE INDEX "courses_user_id_mode_idx" ON "courses"("user_id", "mode");

-- CreateIndex
CREATE UNIQUE INDEX "courses_organization_id_slug_key" ON "courses"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "courses_user_id_slug_key" ON "courses"("user_id", "slug");

-- CreateIndex
CREATE INDEX "daily_progress_user_id_day_of_week_idx" ON "daily_progress"("user_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_user_id_date_key" ON "daily_progress"("user_id", "date");

-- CreateIndex
CREATE INDEX "invitations_organization_id_idx" ON "invitations"("organization_id");

-- CreateIndex
CREATE INDEX "lesson_completions_lesson_id_idx" ON "lesson_completions"("lesson_id");

-- CreateIndex
CREATE INDEX "lesson_completions_user_id_completed_at_idx" ON "lesson_completions"("user_id", "completed_at");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_completions_user_id_lesson_id_key" ON "lesson_completions"("user_id", "lesson_id");

-- CreateIndex
CREATE INDEX "lesson_sentences_sentence_id_idx" ON "lesson_sentences"("sentence_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_sentences_lesson_id_sentence_id_key" ON "lesson_sentences"("lesson_id", "sentence_id");

-- CreateIndex
CREATE INDEX "lesson_words_word_id_idx" ON "lesson_words"("word_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_words_lesson_id_word_id_key" ON "lesson_words"("lesson_id", "word_id");

-- CreateIndex
CREATE INDEX "lessons_organization_id_archived_at_normalized_title_idx" ON "lessons"("organization_id", "archived_at", "normalized_title");

-- CreateIndex
CREATE INDEX "lessons_chapter_id_archived_at_position_idx" ON "lessons"("chapter_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "lessons_organization_id_kind_idx" ON "lessons"("organization_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_chapter_id_slug_key" ON "lessons"("chapter_id", "slug");

-- CreateIndex
CREATE INDEX "members_organization_id_idx" ON "members"("organization_id");

-- CreateIndex
CREATE INDEX "members_user_id_idx" ON "members"("user_id");

-- CreateIndex
CREATE INDEX "search_prompt_suggestions_course_suggestion_id_idx" ON "search_prompt_suggestions"("course_suggestion_id");

-- CreateIndex
CREATE UNIQUE INDEX "search_prompt_suggestions_search_prompt_id_course_suggestio_key" ON "search_prompt_suggestions"("search_prompt_id", "course_suggestion_id");

-- CreateIndex
CREATE UNIQUE INDEX "sentences_organization_id_target_language_sentence_key" ON "sentences"("organization_id", "target_language", "sentence");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_answered_at_idx" ON "step_attempts"("user_id", "answered_at");

-- CreateIndex
CREATE INDEX "step_attempts_step_id_idx" ON "step_attempts"("step_id");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_day_of_week_idx" ON "step_attempts"("user_id", "day_of_week");

-- CreateIndex
CREATE INDEX "step_attempts_user_id_hour_of_day_idx" ON "step_attempts"("user_id", "hour_of_day");

-- CreateIndex
CREATE INDEX "steps_activity_id_archived_at_position_idx" ON "steps"("activity_id", "archived_at", "position");

-- CreateIndex
CREATE INDEX "steps_activity_id_kind_archived_at_position_idx" ON "steps"("activity_id", "kind", "archived_at", "position");

-- CreateIndex
CREATE INDEX "steps_word_id_idx" ON "steps"("word_id");

-- CreateIndex
CREATE INDEX "steps_sentence_id_idx" ON "steps"("sentence_id");

-- CreateIndex
CREATE INDEX "subscriptions_reference_id_idx" ON "subscriptions"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_profiles_user_id_key" ON "user_learning_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_progress_user_id_key" ON "user_progress"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "word_pronunciations_word_id_user_language_key" ON "word_pronunciations"("word_id", "user_language");

-- CreateIndex
CREATE UNIQUE INDEX "words_organization_id_target_language_word_key" ON "words"("organization_id", "target_language", "word");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reviews" ADD CONSTRAINT "content_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_prompt_suggestions" ADD CONSTRAINT "search_prompt_suggestions_search_prompt_id_fkey" FOREIGN KEY ("search_prompt_id") REFERENCES "search_prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_prompt_suggestions" ADD CONSTRAINT "search_prompt_suggestions_course_suggestion_id_fkey" FOREIGN KEY ("course_suggestion_id") REFERENCES "course_suggestions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_alternative_titles" ADD CONSTRAINT "course_alternative_titles_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_categories" ADD CONSTRAINT "course_categories_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_users" ADD CONSTRAINT "course_users_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_users" ADD CONSTRAINT "course_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_progress" ADD CONSTRAINT "activity_progress_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_completions" ADD CONSTRAINT "lesson_completions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_completions" ADD CONSTRAINT "chapter_completions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_attempts" ADD CONSTRAINT "step_attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_profiles" ADD CONSTRAINT "user_learning_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "words" ADD CONSTRAINT "words_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "word_pronunciations" ADD CONSTRAINT "word_pronunciations_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sentences" ADD CONSTRAINT "sentences_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;
