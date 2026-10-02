-- Learning v2 schema.
--
-- Everything learning v2 adds to the database: the Library, goals and plans, the learner's layer
-- (attempts, reviews, memory, the learning_events ledger), exams, language practice, sources and
-- guests. It only adds: the legacy tables, columns and enums stay until the cutover migration after
-- this one has copied what learners keep.

-- CreateEnum
CREATE TYPE "TutorThreadKind" AS ENUM ('lesson', 'chapter', 'plan', 'mock');

-- CreateEnum
CREATE TYPE "MockExamStatus" AS ENUM ('active', 'finished');

-- CreateEnum
CREATE TYPE "VoteValue" AS ENUM ('up', 'down');

-- CreateEnum
CREATE TYPE "FeedbackContentKind" AS ENUM ('course', 'chapter', 'lesson', 'step', 'step_variant', 'item', 'media_asset', 'answer_explanation', 'lesson_question', 'plan', 'plan_change');

-- CreateEnum
CREATE TYPE "ContentFeedbackReason" AS ENUM ('hard_to_follow', 'wrong_or_outdated', 'too_easy', 'too_hard', 'not_what_i_needed', 'something_else');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('new', 'read', 'replied');

-- CreateEnum
CREATE TYPE "GoalKind" AS ENUM ('learn', 'explain', 'language', 'exam');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('active', 'paused', 'completed', 'archived');

-- CreateEnum
CREATE TYPE "PlanItemKind" AS ENUM ('lesson', 'chapter', 'checkpoint', 'mock', 'review', 'boss');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('todo', 'done', 'skipped', 'tested_out');

-- CreateEnum
CREATE TYPE "SuggestedGoalStatus" AS ENUM ('pending', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "PlanChangeStatus" AS ENUM ('proposed', 'applied', 'declined', 'undone');

-- CreateEnum
CREATE TYPE "ResearchUploadReason" AS ENUM ('no_official_source', 'unverified', 'class_material');

-- CreateEnum
CREATE TYPE "LanguageSkill" AS ENUM ('reading', 'listening', 'speaking', 'writing');

-- CreateEnum
CREATE TYPE "LanguageConversationKind" AS ENUM ('practice', 'checkpoint', 'speaking_mock');

-- CreateEnum
CREATE TYPE "LanguageConversationStatus" AS ENUM ('ready', 'completed');

-- CreateEnum
CREATE TYPE "MistakePatternKind" AS ENUM ('pattern', 'typos');

-- CreateEnum
CREATE TYPE "MasteryState" AS ENUM ('new', 'learning', 'solid', 'mastered');

-- CreateEnum
CREATE TYPE "MistakeCause" AS ENUM ('gap', 'misread', 'trap', 'time', 'guess');

-- CreateEnum
CREATE TYPE "MistakeStatus" AS ENUM ('open', 'fixed');

-- CreateEnum
CREATE TYPE "CourseLevel" AS ENUM ('overview', 'beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "LibraryVisibility" AS ENUM ('public', 'private');

-- CreateEnum
CREATE TYPE "LibraryStepKind" AS ENUM ('hook', 'explanation', 'worked_example', 'check', 'typed_answer', 'spoken_answer', 'activity', 'multiple_choice', 'fill_blank', 'match_columns', 'vocabulary', 'reading', 'listening', 'translation', 'alphabet', 'summary', 'challenge');

-- CreateEnum
CREATE TYPE "StepVariantKind" AS ENUM ('simpler', 'deeper', 'field', 'tool');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('image', 'audio');

-- CreateEnum
CREATE TYPE "MemoryCategory" AS ENUM ('goals', 'background', 'routine', 'preferences', 'learning', 'context');

-- CreateEnum
CREATE TYPE "MemoryOrigin" AS ENUM ('said', 'noticed');

-- CreateEnum
CREATE TYPE "MemoryFactStatus" AS ENUM ('active', 'superseded', 'deleted');

-- CreateEnum
CREATE TYPE "MemoryInsightKind" AS ENUM ('tip', 'plan_change', 'schedule_idea');

-- CreateEnum
CREATE TYPE "MemoryInsightStatus" AS ENUM ('pending', 'accepted', 'dismissed');

-- CreateEnum
CREATE TYPE "MilestoneKind" AS ENUM ('badge', 'belt', 'glasses', 'buddy_stage');

-- CreateEnum
CREATE TYPE "OnboardingDraftStatus" AS ENUM ('understanding', 'understood', 'failed');

-- CreateEnum
CREATE TYPE "ItemFormat" AS ENUM ('multiple_choice', 'true_false', 'typed', 'spoken', 'essay', 'match_pairs', 'order', 'numeric');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('official', 'secondary', 'upload');

-- CreateEnum
CREATE TYPE "LearnerSourceOrigin" AS ENUM ('upload', 'research');

-- CreateEnum
CREATE TYPE "ContentReviewStatus" AS ENUM ('open', 'rewritten', 'dismissed');

-- CreateEnum
CREATE TYPE "LearningEventKind" AS ENUM ('lesson', 'review', 'questions', 'mock', 'checkpoint', 'session', 'explanation', 'conversation');

-- CreateEnum
CREATE TYPE "StudyBlockKind" AS ENUM ('review', 'learn', 'practice', 'produce', 'checkpoint');

-- CreateEnum
CREATE TYPE "StudySessionStatus" AS ENUM ('planned', 'active', 'completed');

-- CreateEnum
CREATE TYPE "StudyBlockStatus" AS ENUM ('pending', 'active', 'completed', 'skipped');

-- CreateEnum
CREATE TYPE "StudyFreshStart" AS ENUM ('welcome_back', 'new_week', 'new_phase');

-- CreateEnum
CREATE TYPE "UsageKind" AS ENUM ('lesson_start', 'explanation', 'goal', 'tutor_message', 'upload', 'conversation', 'assist');

-- CreateEnum
CREATE TYPE "ExperienceMode" AS ENUM ('focus', 'fun');

-- CreateEnum
CREATE TYPE "BuddyKind" AS ENUM ('zu', 'noodle', 'beep', 'otto');

-- CreateEnum
CREATE TYPE "BuddyGlasses" AS ENUM ('round', 'star', 'aviator', 'cat_eye', 'retro', 'monocle');

-- CreateEnum
CREATE TYPE "GuardianLinkStatus" AS ENUM ('pending', 'active', 'revoked');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LessonQuestionContextKind" ADD VALUE 'chapter';
ALTER TYPE "LessonQuestionContextKind" ADD VALUE 'plan';
ALTER TYPE "LessonQuestionContextKind" ADD VALUE 'mock';

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "details_generated_at" TIMESTAMP(3),
ADD COLUMN     "details_model" TEXT,
ADD COLUMN     "details_prompt_version" TEXT,
ADD COLUMN     "details_run_id" TEXT,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "icon_generated_at" TIMESTAMP(3),
ADD COLUMN     "icon_model" TEXT,
ADD COLUMN     "icon_prompt_version" TEXT,
ADD COLUMN     "icon_run_id" TEXT,
ADD COLUMN     "model" TEXT,
ADD COLUMN     "outline_run_id" TEXT,
ADD COLUMN     "outline_status" "GenerationStatus",
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "run_id" TEXT,
ADD COLUMN     "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public';

-- AlterTable
ALTER TABLE "daily_progress" ADD COLUMN     "lessons_completed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "lesson_question_threads" ADD COLUMN     "chapter_id" UUID,
ADD COLUMN     "goal_id" UUID,
ADD COLUMN     "kind" "TutorThreadKind" NOT NULL DEFAULT 'lesson',
ADD COLUMN     "library_lesson_id" UUID,
ADD COLUMN     "mock_exam_id" UUID;

-- AlterTable
ALTER TABLE "lesson_questions" ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "library_step_id" UUID,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "run_id" TEXT,
ADD COLUMN     "shared_answer_id" UUID;

-- AlterTable
ALTER TABLE "sentences" ADD COLUMN     "audio_generated_at" TIMESTAMP(3),
ADD COLUMN     "audio_model" TEXT,
ADD COLUMN     "audio_prompt_version" TEXT,
ADD COLUMN     "audio_run_id" TEXT,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "run_id" TEXT;

-- AlterTable
ALTER TABLE "user_learning_profiles" ADD COLUMN     "active_goal_id" UUID,
ADD COLUMN     "birth_month" SMALLINT,
ADD COLUMN     "birth_year" SMALLINT,
ADD COLUMN     "buddy_glasses" "BuddyGlasses" NOT NULL DEFAULT 'round',
ADD COLUMN     "buddy_kind" "BuddyKind",
ADD COLUMN     "buddy_name" TEXT,
ADD COLUMN     "daily_limit_minutes" SMALLINT,
ADD COLUMN     "deeper_by_default" BOOLEAN,
ADD COLUMN     "experience_mode" "ExperienceMode" NOT NULL DEFAULT 'focus',
ADD COLUMN     "memory_asks_deeper" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "memory_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sounds_enabled" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "is_anonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "word_pronunciations" ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "run_id" TEXT,
ADD COLUMN     "tip" TEXT;

-- AlterTable
ALTER TABLE "words" ADD COLUMN     "audio_generated_at" TIMESTAMP(3),
ADD COLUMN     "audio_model" TEXT,
ADD COLUMN     "audio_prompt_version" TEXT,
ADD COLUMN     "audio_run_id" TEXT,
ADD COLUMN     "generated_at" TIMESTAMP(3),
ADD COLUMN     "model" TEXT,
ADD COLUMN     "prompt_version" TEXT,
ADD COLUMN     "run_id" TEXT;

-- CreateTable
CREATE TABLE "evaluation_runs" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "task" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "requested_model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "user_id" UUID,
    "goal_id" UUID,
    "content_scope" VARCHAR(10) NOT NULL,
    "trace_id" TEXT,
    "input" JSONB,
    "input_hash" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_exams" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "block_id" UUID,
    "exam_blueprint_id" UUID,
    "status" "MockExamStatus" NOT NULL DEFAULT 'active',
    "conditions" JSONB NOT NULL,
    "section_index" SMALLINT NOT NULL DEFAULT 0,
    "section_started_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_exams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mock_exam_answers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "mock_exam_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "answer" JSONB,
    "flagged" BOOLEAN NOT NULL DEFAULT false,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_exam_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_results" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "exam_blueprint_id" UUID,
    "exam_name" TEXT NOT NULL,
    "exam_date" DATE,
    "score" DOUBLE PRECISION,
    "scale" TEXT,
    "max_score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "estimate_low" DOUBLE PRECISION,
    "estimate_high" DOUBLE PRECISION,
    "mocks_taken" SMALLINT NOT NULL DEFAULT 0,
    "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_feedback" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "content_kind" "FeedbackContentKind" NOT NULL,
    "content_id" UUID NOT NULL,
    "vote" "VoteValue",
    "reasons" "ContentFeedbackReason"[] DEFAULT ARRAY[]::"ContentFeedbackReason"[],
    "comment" TEXT,
    "language" VARCHAR(10),
    "mode" "ExperienceMode",
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feedback" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID,
    "email" TEXT,
    "message" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'new',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "GoalKind" NOT NULL,
    "status" "GoalStatus" NOT NULL DEFAULT 'active',
    "prompt" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10),
    "target_date" DATE,
    "daily_minutes" SMALLINT NOT NULL,
    "study_time" VARCHAR(5),
    "timezone" TEXT,
    "exam_blueprint_id" UUID,
    "primary_course_id" UUID,
    "generation_run_id" TEXT,
    "research_run_id" TEXT,
    "research_upload_reason" "ResearchUploadReason",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "goal_id" UUID NOT NULL,
    "phases" JSONB NOT NULL DEFAULT '[]',
    "graph" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "estimate_hours" DOUBLE PRECISION,
    "version" INTEGER NOT NULL DEFAULT 1,
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "build_failed_at" TIMESTAMP(3),
    "placement_prepared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "plan_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "phase" SMALLINT NOT NULL,
    "kind" "PlanItemKind" NOT NULL,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'todo',
    "lesson_id" UUID,
    "chapter_id" UUID,
    "skill_id" UUID,
    "title_snapshot" TEXT NOT NULL,
    "scheduled_for" DATE,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_changes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "plan_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "PlanChangeStatus" NOT NULL DEFAULT 'applied',
    "reason" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suggested_goals" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "last_active_at" TIMESTAMP(3) NOT NULL,
    "status" "SuggestedGoalStatus" NOT NULL DEFAULT 'pending',
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggested_goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_skill_levels" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "skill" "LanguageSkill" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "start_score" DOUBLE PRECISION NOT NULL,
    "window_correct" INTEGER NOT NULL DEFAULT 0,
    "window_total" INTEGER NOT NULL DEFAULT 0,
    "window_ceiling" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_skill_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_words" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "word_id" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "learned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_words_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pronunciation_reviews" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "user_language" VARCHAR(10) NOT NULL,
    "stage" SMALLINT NOT NULL DEFAULT 0,
    "due_at" TIMESTAMP(3),
    "last_reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pronunciation_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_conversations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "chapter_id" UUID,
    "study_block_id" UUID,
    "kind" "LanguageConversationKind" NOT NULL,
    "status" "LanguageConversationStatus" NOT NULL DEFAULT 'ready',
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "level" VARCHAR(3) NOT NULL,
    "minutes" SMALLINT NOT NULL,
    "scenario" JSONB NOT NULL,
    "title_snapshot" TEXT NOT NULL,
    "live_model" TEXT,
    "objectives_met" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "used_help" BOOLEAN NOT NULL DEFAULT false,
    "spoken_seconds" INTEGER NOT NULL DEFAULT 0,
    "feedback" JSONB,
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_scenarios" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "chapter_id" UUID NOT NULL,
    "level" VARCHAR(3) NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "language_level_tests" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10) NOT NULL,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "language_level_tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistake_patterns" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "kind" "MistakePatternKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "mistake_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "practiced_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mistake_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_skills" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "state" "MasteryState" NOT NULL DEFAULT 'new',
    "stability" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "due" TIMESTAMP(3),
    "last_reviewed_at" TIMESTAMP(3),
    "reps" INTEGER NOT NULL DEFAULT 0,
    "lapses" INTEGER NOT NULL DEFAULT 0,
    "recall_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attempts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "step_id" UUID,
    "item_id" UUID,
    "skill_id" UUID,
    "study_session_id" UUID,
    "mock_exam_id" UUID,
    "answer" JSONB NOT NULL,
    "target_language" VARCHAR(10),
    "is_correct" BOOLEAN NOT NULL,
    "score" DOUBLE PRECISION,
    "duration_ms" INTEGER NOT NULL,
    "answered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "local_date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "weekday" SMALLINT NOT NULL,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mistakes" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "skill_id" UUID,
    "item_id" UUID,
    "step_id" UUID,
    "attempt_id" UUID,
    "cause" "MistakeCause",
    "status" "MistakeStatus" NOT NULL DEFAULT 'open',
    "fixed_at" TIMESTAMP(3),
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mistakes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tutor_shared_answers" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "step_id" UUID NOT NULL,
    "normalized_question" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tutor_shared_answers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_chapters" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10),
    "identity_key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "objectives" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "level" "CourseLevel" NOT NULL,
    "home_course_id" UUID,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "outline_status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "outline_run_id" TEXT,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_chapters" (
    "course_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "level" "CourseLevel" NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_chapters_pkey" PRIMARY KEY ("course_id","chapter_id")
);

-- CreateTable
CREATE TABLE "chapter_skills" (
    "chapter_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_skills_pkey" PRIMARY KEY ("chapter_id","skill_id")
);

-- CreateTable
CREATE TABLE "library_lessons" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10),
    "identity_key" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "normalized_title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "can_do" TEXT,
    "level" "CourseLevel" NOT NULL,
    "estimated_minutes" SMALLINT NOT NULL,
    "home_chapter_id" UUID,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "spec" JSONB,
    "spec_status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "spec_run_id" TEXT,
    "content_status" "GenerationStatus" NOT NULL DEFAULT 'pending',
    "content_run_id" TEXT,
    "held_back_drafts" JSONB NOT NULL DEFAULT '[]',
    "set_aside_at" TIMESTAMP(3),
    "summary" JSONB,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapter_lessons" (
    "chapter_id" UUID NOT NULL,
    "lesson_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_lessons_pkey" PRIMARY KEY ("chapter_id","lesson_id")
);

-- CreateTable
CREATE TABLE "library_steps" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "lesson_id" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "LibraryStepKind" NOT NULL,
    "contract_version" SMALLINT NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "skill_id" UUID,
    "item_id" UUID,
    "word_id" UUID,
    "sentence_id" UUID,
    "media_asset_id" UUID,
    "source_id" UUID,
    "source_page" SMALLINT,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_variants" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "step_id" UUID NOT NULL,
    "kind" "StepVariantKind" NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "contract_version" SMALLINT NOT NULL DEFAULT 1,
    "content" JSONB NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_example_lines" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "step_id" UUID NOT NULL,
    "text" TEXT,
    "context_key" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_example_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "mime_type" TEXT,
    "reuse_key" TEXT NOT NULL,
    "language" VARCHAR(10),
    "prompt" TEXT,
    "scene" JSONB,
    "palette" TEXT,
    "style_version" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_ms" INTEGER,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_facts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "category" "MemoryCategory" NOT NULL,
    "statement" TEXT NOT NULL,
    "origin" "MemoryOrigin" NOT NULL,
    "status" "MemoryFactStatus" NOT NULL DEFAULT 'active',
    "superseded_by_id" UUID,
    "confidence" DOUBLE PRECISION,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "source_ref" JSONB,
    "expires_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memory_insights" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "local_date" DATE NOT NULL,
    "kind" "MemoryInsightKind",
    "message" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" "MemoryInsightStatus" NOT NULL DEFAULT 'pending',
    "input_hash" TEXT NOT NULL,
    "responded_at" TIMESTAMP(3),
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "MilestoneKind" NOT NULL,
    "key" TEXT NOT NULL,
    "earned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shown_at" TIMESTAMP(3),

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_understandings" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "normalized_prompt" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "model" TEXT,
    "prompt_version" TEXT,
    "run_id" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_understandings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instrument_waitlist_entries" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "instrument" TEXT NOT NULL,
    "normalized_instrument" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instrument_waitlist_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "onboarding_drafts" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "prompt" TEXT NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "time_zone" TEXT NOT NULL,
    "status" "OnboardingDraftStatus" NOT NULL DEFAULT 'understanding',
    "understanding" JSONB,
    "run_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skills" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "target_language" VARCHAR(10),
    "identity_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "example" TEXT,
    "level" "CourseLevel",
    "merged_into_id" UUID,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "skill_prerequisites" (
    "skill_id" UUID NOT NULL,
    "prerequisite_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "skill_prerequisites_pkey" PRIMARY KEY ("skill_id","prerequisite_id")
);

-- CreateTable
CREATE TABLE "lesson_skills" (
    "lesson_id" UUID NOT NULL,
    "skill_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_skills_pkey" PRIMARY KEY ("lesson_id","skill_id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "skill_id" UUID NOT NULL,
    "language" VARCHAR(10) NOT NULL,
    "format" "ItemFormat" NOT NULL,
    "field" TEXT,
    "content" JSONB NOT NULL,
    "difficulty" DOUBLE PRECISION,
    "discrimination" DOUBLE PRECISION,
    "exam_blueprint_id" UUID,
    "source_id" UUID,
    "source_citation" TEXT,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "answer_explanations" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "item_id" UUID,
    "step_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "normalized_answer" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "answer_explanations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "identity_key" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "url" TEXT,
    "title" TEXT NOT NULL,
    "publisher" TEXT,
    "mime_type" TEXT,
    "blob_url" TEXT,
    "content_hash" TEXT NOT NULL,
    "fetched_at" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3),
    "next_check_at" TIMESTAMP(3),
    "extracted_text" TEXT,
    "structure" JSONB,
    "reuse_policy" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exam_blueprints" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "language" VARCHAR(10) NOT NULL,
    "identity_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "country" VARCHAR(2) NOT NULL,
    "board" TEXT,
    "role" TEXT,
    "visibility" "LibraryVisibility" NOT NULL DEFAULT 'public',
    "owner_id" UUID,
    "structure" JSONB NOT NULL,
    "edition" JSONB,
    "topic_frequency" JSONB,
    "source_id" UUID,
    "valid_until" TIMESTAMP(3),
    "next_check_at" TIMESTAMP(3),
    "registration_ends_at" TIMESTAMP(3),
    "exam_date" TIMESTAMP(3),
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exam_blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learner_sources" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "goal_id" UUID,
    "origin" "LearnerSourceOrigin" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learner_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_change_notices" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "source_id" UUID NOT NULL,
    "exam_blueprint_id" UUID,
    "language" VARCHAR(10) NOT NULL,
    "message" TEXT NOT NULL,
    "fields" TEXT[],
    "previous_hash" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_change_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_review_flags" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "notice_id" UUID NOT NULL,
    "lesson_id" UUID,
    "item_id" UUID,
    "status" "ContentReviewStatus" NOT NULL DEFAULT 'open',
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_review_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_events" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "LearningEventKind" NOT NULL,
    "lesson_kind" TEXT,
    "mode" "ExperienceMode",
    "goal_id" UUID,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3),
    "local_date" DATE NOT NULL,
    "hour" SMALLINT NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "correct_answers" INTEGER NOT NULL DEFAULT 0,
    "incorrect_answers" INTEGER NOT NULL DEFAULT 0,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "brain_power" INTEGER NOT NULL DEFAULT 0,
    "energy_delta" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "content_ids" JSONB NOT NULL DEFAULT '{}',
    "title_snapshot" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_sessions" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "goal_id" UUID,
    "local_date" DATE NOT NULL,
    "status" "StudySessionStatus" NOT NULL DEFAULT 'planned',
    "planned_minutes" SMALLINT NOT NULL,
    "fresh_start" "StudyFreshStart",
    "start_snapshot" JSONB,
    "full_meal_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "study_session_blocks" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "session_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "kind" "StudyBlockKind" NOT NULL,
    "status" "StudyBlockStatus" NOT NULL DEFAULT 'pending',
    "lesson_id" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "can_do" TEXT,
    "estimated_minutes" SMALLINT,
    "brain_power" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "study_session_blocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "kind" "UsageKind" NOT NULL,
    "target_id" UUID NOT NULL,
    "generated" BOOLEAN NOT NULL DEFAULT false,
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "newcomer_spend_days" (
    "day" DATE NOT NULL,
    "spent_micros" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "newcomer_spend_days_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "guardian_links" (
    "id" UUID NOT NULL DEFAULT uuidv7(),
    "user_id" UUID NOT NULL,
    "guardian_email" TEXT NOT NULL,
    "status" "GuardianLinkStatus" NOT NULL DEFAULT 'pending',
    "token_hash" TEXT NOT NULL,
    "daily_limit_minutes" SMALLINT,
    "plus_approved_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "accepted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "guardian_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_words" (
    "lesson_id" UUID NOT NULL,
    "word_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "translation" TEXT NOT NULL,
    "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "note" TEXT,
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_words_pkey" PRIMARY KEY ("lesson_id","word_id")
);

-- CreateTable
CREATE TABLE "lesson_sentences" (
    "lesson_id" UUID NOT NULL,
    "sentence_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "translation" TEXT NOT NULL,
    "explanation" TEXT NOT NULL,
    "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "translation_distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "model" TEXT NOT NULL,
    "prompt_version" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_sentences_pkey" PRIMARY KEY ("lesson_id","sentence_id")
);

-- CreateIndex
CREATE INDEX "evaluation_runs_task_created_at_idx" ON "evaluation_runs"("task", "created_at");

-- CreateIndex
CREATE INDEX "evaluation_runs_created_at_idx" ON "evaluation_runs"("created_at");

-- CreateIndex
CREATE INDEX "evaluation_runs_user_id_idx" ON "evaluation_runs"("user_id");

-- CreateIndex
CREATE INDEX "evaluation_runs_goal_id_idx" ON "evaluation_runs"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_exams_block_id_key" ON "mock_exams"("block_id");

-- CreateIndex
CREATE INDEX "mock_exams_user_id_goal_id_finished_at_idx" ON "mock_exams"("user_id", "goal_id", "finished_at");

-- CreateIndex
CREATE INDEX "mock_exams_goal_id_idx" ON "mock_exams"("goal_id");

-- CreateIndex
CREATE INDEX "mock_exams_exam_blueprint_id_idx" ON "mock_exams"("exam_blueprint_id");

-- CreateIndex
CREATE UNIQUE INDEX "mock_exam_answers_mock_exam_id_item_id_key" ON "mock_exam_answers"("mock_exam_id", "item_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_results_goal_id_key" ON "exam_results"("goal_id");

-- CreateIndex
CREATE INDEX "exam_results_user_id_idx" ON "exam_results"("user_id");

-- CreateIndex
CREATE INDEX "exam_results_exam_blueprint_id_reported_at_idx" ON "exam_results"("exam_blueprint_id", "reported_at");

-- CreateIndex
CREATE INDEX "content_feedback_content_kind_content_id_idx" ON "content_feedback"("content_kind", "content_id");

-- CreateIndex
CREATE INDEX "content_feedback_model_prompt_version_idx" ON "content_feedback"("model", "prompt_version");

-- CreateIndex
CREATE UNIQUE INDEX "content_feedback_user_id_content_kind_content_id_key" ON "content_feedback"("user_id", "content_kind", "content_id");

-- CreateIndex
CREATE INDEX "feedback_status_created_at_idx" ON "feedback"("status", "created_at");

-- CreateIndex
CREATE INDEX "feedback_user_id_idx" ON "feedback"("user_id");

-- CreateIndex
CREATE INDEX "goals_user_id_status_idx" ON "goals"("user_id", "status");

-- CreateIndex
CREATE INDEX "goals_exam_blueprint_id_idx" ON "goals"("exam_blueprint_id");

-- CreateIndex
CREATE INDEX "goals_primary_course_id_idx" ON "goals"("primary_course_id");

-- CreateIndex
CREATE UNIQUE INDEX "plans_goal_id_key" ON "plans"("goal_id");

-- CreateIndex
CREATE INDEX "plan_items_lesson_id_idx" ON "plan_items"("lesson_id");

-- CreateIndex
CREATE INDEX "plan_items_chapter_id_idx" ON "plan_items"("chapter_id");

-- CreateIndex
CREATE INDEX "plan_items_skill_id_idx" ON "plan_items"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "plan_items_plan_id_position_key" ON "plan_items"("plan_id", "position");

-- CreateIndex
CREATE INDEX "plan_changes_plan_id_created_at_idx" ON "plan_changes"("plan_id", "created_at");

-- CreateIndex
CREATE INDEX "suggested_goals_user_id_status_idx" ON "suggested_goals"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "suggested_goals_user_id_course_id_key" ON "suggested_goals"("user_id", "course_id");

-- CreateIndex
CREATE UNIQUE INDEX "language_skill_levels_user_id_language_skill_key" ON "language_skill_levels"("user_id", "language", "skill");

-- CreateIndex
CREATE INDEX "learner_words_user_id_language_learned_at_idx" ON "learner_words"("user_id", "language", "learned_at");

-- CreateIndex
CREATE UNIQUE INDEX "learner_words_user_id_word_id_key" ON "learner_words"("user_id", "word_id");

-- CreateIndex
CREATE INDEX "pronunciation_reviews_user_id_language_due_at_idx" ON "pronunciation_reviews"("user_id", "language", "due_at");

-- CreateIndex
CREATE INDEX "pronunciation_reviews_word_id_idx" ON "pronunciation_reviews"("word_id");

-- CreateIndex
CREATE UNIQUE INDEX "pronunciation_reviews_user_id_word_id_key" ON "pronunciation_reviews"("user_id", "word_id");

-- CreateIndex
CREATE UNIQUE INDEX "language_conversations_study_block_id_key" ON "language_conversations"("study_block_id");

-- CreateIndex
CREATE INDEX "language_conversations_user_id_created_at_idx" ON "language_conversations"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "language_conversations_goal_id_idx" ON "language_conversations"("goal_id");

-- CreateIndex
CREATE INDEX "language_conversations_chapter_id_idx" ON "language_conversations"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_scenarios_chapter_id_level_key" ON "conversation_scenarios"("chapter_id", "level");

-- CreateIndex
CREATE UNIQUE INDEX "language_level_tests_language_target_language_key" ON "language_level_tests"("language", "target_language");

-- CreateIndex
CREATE INDEX "mistake_patterns_user_id_language_created_at_idx" ON "mistake_patterns"("user_id", "language", "created_at");

-- CreateIndex
CREATE INDEX "mistake_patterns_goal_id_idx" ON "mistake_patterns"("goal_id");

-- CreateIndex
CREATE INDEX "learner_skills_user_id_due_idx" ON "learner_skills"("user_id", "due");

-- CreateIndex
CREATE INDEX "learner_skills_skill_id_idx" ON "learner_skills"("skill_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_skills_user_id_skill_id_key" ON "learner_skills"("user_id", "skill_id");

-- CreateIndex
CREATE INDEX "attempts_user_id_answered_at_idx" ON "attempts"("user_id", "answered_at");

-- CreateIndex
CREATE INDEX "attempts_user_id_skill_id_idx" ON "attempts"("user_id", "skill_id");

-- CreateIndex
CREATE INDEX "attempts_step_id_idx" ON "attempts"("step_id");

-- CreateIndex
CREATE INDEX "attempts_item_id_idx" ON "attempts"("item_id");

-- CreateIndex
CREATE INDEX "attempts_skill_id_idx" ON "attempts"("skill_id");

-- CreateIndex
CREATE INDEX "attempts_study_session_id_idx" ON "attempts"("study_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "attempts_mock_exam_id_item_id_key" ON "attempts"("mock_exam_id", "item_id");

-- CreateIndex
CREATE INDEX "mistakes_user_id_status_created_at_idx" ON "mistakes"("user_id", "status", "created_at");

-- CreateIndex
CREATE INDEX "mistakes_skill_id_idx" ON "mistakes"("skill_id");

-- CreateIndex
CREATE INDEX "mistakes_item_id_idx" ON "mistakes"("item_id");

-- CreateIndex
CREATE INDEX "mistakes_step_id_idx" ON "mistakes"("step_id");

-- CreateIndex
CREATE INDEX "mistakes_attempt_id_idx" ON "mistakes"("attempt_id");

-- CreateIndex
CREATE UNIQUE INDEX "tutor_shared_answers_step_id_normalized_question_key" ON "tutor_shared_answers"("step_id", "normalized_question");

-- CreateIndex
CREATE INDEX "library_chapters_language_level_normalized_title_idx" ON "library_chapters"("language", "level", "normalized_title");

-- CreateIndex
CREATE INDEX "library_chapters_owner_id_idx" ON "library_chapters"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_chapters_language_identity_key_key" ON "library_chapters"("language", "identity_key");

-- CreateIndex
CREATE UNIQUE INDEX "library_chapters_home_course_id_slug_key" ON "library_chapters"("home_course_id", "slug");

-- CreateIndex
CREATE INDEX "course_chapters_chapter_id_idx" ON "course_chapters"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_chapters_course_id_level_position_key" ON "course_chapters"("course_id", "level", "position");

-- CreateIndex
CREATE INDEX "chapter_skills_skill_id_idx" ON "chapter_skills"("skill_id");

-- CreateIndex
CREATE INDEX "library_lessons_language_level_normalized_title_idx" ON "library_lessons"("language", "level", "normalized_title");

-- CreateIndex
CREATE INDEX "library_lessons_owner_id_idx" ON "library_lessons"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_lessons_language_identity_key_key" ON "library_lessons"("language", "identity_key");

-- CreateIndex
CREATE UNIQUE INDEX "library_lessons_home_chapter_id_slug_key" ON "library_lessons"("home_chapter_id", "slug");

-- CreateIndex
CREATE INDEX "chapter_lessons_lesson_id_idx" ON "chapter_lessons"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_lessons_chapter_id_position_key" ON "chapter_lessons"("chapter_id", "position");

-- CreateIndex
CREATE INDEX "library_steps_skill_id_idx" ON "library_steps"("skill_id");

-- CreateIndex
CREATE INDEX "library_steps_item_id_idx" ON "library_steps"("item_id");

-- CreateIndex
CREATE INDEX "library_steps_word_id_idx" ON "library_steps"("word_id");

-- CreateIndex
CREATE INDEX "library_steps_sentence_id_idx" ON "library_steps"("sentence_id");

-- CreateIndex
CREATE INDEX "library_steps_media_asset_id_idx" ON "library_steps"("media_asset_id");

-- CreateIndex
CREATE INDEX "library_steps_source_id_idx" ON "library_steps"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "library_steps_lesson_id_position_key" ON "library_steps"("lesson_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "step_variants_step_id_kind_key_key" ON "step_variants"("step_id", "kind", "key");

-- CreateIndex
CREATE INDEX "step_example_lines_step_id_idx" ON "step_example_lines"("step_id");

-- CreateIndex
CREATE UNIQUE INDEX "step_example_lines_user_id_step_id_key" ON "step_example_lines"("user_id", "step_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_reuse_key_key" ON "media_assets"("reuse_key");

-- CreateIndex
CREATE INDEX "media_assets_owner_id_idx" ON "media_assets"("owner_id");

-- CreateIndex
CREATE INDEX "memory_facts_user_id_category_status_idx" ON "memory_facts"("user_id", "category", "status");

-- CreateIndex
CREATE INDEX "memory_facts_superseded_by_id_idx" ON "memory_facts"("superseded_by_id");

-- CreateIndex
CREATE INDEX "memory_facts_deleted_at_idx" ON "memory_facts"("deleted_at");

-- CreateIndex
CREATE INDEX "memory_insights_goal_id_idx" ON "memory_insights"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "memory_insights_user_id_local_date_key" ON "memory_insights"("user_id", "local_date");

-- CreateIndex
CREATE UNIQUE INDEX "milestones_user_id_kind_key_key" ON "milestones"("user_id", "kind", "key");

-- CreateIndex
CREATE UNIQUE INDEX "goal_understandings_language_normalized_prompt_key" ON "goal_understandings"("language", "normalized_prompt");

-- CreateIndex
CREATE INDEX "instrument_waitlist_entries_normalized_instrument_idx" ON "instrument_waitlist_entries"("normalized_instrument");

-- CreateIndex
CREATE UNIQUE INDEX "instrument_waitlist_entries_user_id_normalized_instrument_key" ON "instrument_waitlist_entries"("user_id", "normalized_instrument");

-- CreateIndex
CREATE INDEX "onboarding_drafts_user_id_updated_at_idx" ON "onboarding_drafts"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "skills_language_normalized_name_idx" ON "skills"("language", "normalized_name");

-- CreateIndex
CREATE INDEX "skills_merged_into_id_idx" ON "skills"("merged_into_id");

-- CreateIndex
CREATE INDEX "skills_owner_id_idx" ON "skills"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "skills_language_identity_key_key" ON "skills"("language", "identity_key");

-- CreateIndex
CREATE INDEX "skill_prerequisites_prerequisite_id_idx" ON "skill_prerequisites"("prerequisite_id");

-- CreateIndex
CREATE INDEX "lesson_skills_skill_id_idx" ON "lesson_skills"("skill_id");

-- CreateIndex
CREATE INDEX "items_skill_id_format_idx" ON "items"("skill_id", "format");

-- CreateIndex
CREATE INDEX "items_exam_blueprint_id_idx" ON "items"("exam_blueprint_id");

-- CreateIndex
CREATE INDEX "items_source_id_idx" ON "items"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "answer_explanations_item_id_normalized_answer_language_key" ON "answer_explanations"("item_id", "normalized_answer", "language");

-- CreateIndex
CREATE UNIQUE INDEX "answer_explanations_step_id_normalized_answer_language_key" ON "answer_explanations"("step_id", "normalized_answer", "language");

-- CreateIndex
CREATE INDEX "sources_content_hash_idx" ON "sources"("content_hash");

-- CreateIndex
CREATE INDEX "sources_next_check_at_idx" ON "sources"("next_check_at");

-- CreateIndex
CREATE INDEX "sources_owner_id_idx" ON "sources"("owner_id");

-- CreateIndex
CREATE UNIQUE INDEX "sources_language_identity_key_key" ON "sources"("language", "identity_key");

-- CreateIndex
CREATE INDEX "exam_blueprints_next_check_at_idx" ON "exam_blueprints"("next_check_at");

-- CreateIndex
CREATE INDEX "exam_blueprints_owner_id_idx" ON "exam_blueprints"("owner_id");

-- CreateIndex
CREATE INDEX "exam_blueprints_source_id_idx" ON "exam_blueprints"("source_id");

-- CreateIndex
CREATE UNIQUE INDEX "exam_blueprints_language_identity_key_key" ON "exam_blueprints"("language", "identity_key");

-- CreateIndex
CREATE INDEX "learner_sources_user_id_created_at_idx" ON "learner_sources"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "learner_sources_source_id_idx" ON "learner_sources"("source_id");

-- CreateIndex
CREATE INDEX "learner_sources_goal_id_idx" ON "learner_sources"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "learner_sources_user_id_source_id_key" ON "learner_sources"("user_id", "source_id");

-- CreateIndex
CREATE INDEX "source_change_notices_exam_blueprint_id_created_at_idx" ON "source_change_notices"("exam_blueprint_id", "created_at");

-- CreateIndex
CREATE INDEX "source_change_notices_source_id_created_at_idx" ON "source_change_notices"("source_id", "created_at");

-- CreateIndex
CREATE INDEX "content_review_flags_status_created_at_idx" ON "content_review_flags"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_review_flags_lesson_id_status_idx" ON "content_review_flags"("lesson_id", "status");

-- CreateIndex
CREATE INDEX "content_review_flags_item_id_status_idx" ON "content_review_flags"("item_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "content_review_flags_notice_id_lesson_id_key" ON "content_review_flags"("notice_id", "lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_review_flags_notice_id_item_id_key" ON "content_review_flags"("notice_id", "item_id");

-- CreateIndex
CREATE INDEX "learning_events_user_id_local_date_idx" ON "learning_events"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "learning_events_user_id_hour_idx" ON "learning_events"("user_id", "hour");

-- CreateIndex
CREATE INDEX "learning_events_local_date_idx" ON "learning_events"("local_date");

-- CreateIndex
CREATE INDEX "study_sessions_user_id_local_date_idx" ON "study_sessions"("user_id", "local_date");

-- CreateIndex
CREATE INDEX "study_sessions_goal_id_idx" ON "study_sessions"("goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_sessions_user_id_goal_id_local_date_key" ON "study_sessions"("user_id", "goal_id", "local_date");

-- CreateIndex
CREATE INDEX "study_session_blocks_lesson_id_idx" ON "study_session_blocks"("lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "study_session_blocks_session_id_position_key" ON "study_session_blocks"("session_id", "position");

-- CreateIndex
CREATE INDEX "usage_records_user_id_created_at_idx" ON "usage_records"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_user_id_kind_target_id_key" ON "usage_records"("user_id", "kind", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "guardian_links_token_hash_key" ON "guardian_links"("token_hash");

-- CreateIndex
CREATE INDEX "guardian_links_user_id_idx" ON "guardian_links"("user_id");

-- CreateIndex
CREATE INDEX "lesson_words_word_id_idx" ON "lesson_words"("word_id");

-- CreateIndex
CREATE INDEX "lesson_sentences_sentence_id_idx" ON "lesson_sentences"("sentence_id");

-- CreateIndex
CREATE INDEX "lesson_question_threads_library_lesson_id_idx" ON "lesson_question_threads"("library_lesson_id");

-- CreateIndex
CREATE INDEX "lesson_question_threads_chapter_id_idx" ON "lesson_question_threads"("chapter_id");

-- CreateIndex
CREATE INDEX "lesson_question_threads_goal_id_idx" ON "lesson_question_threads"("goal_id");

-- CreateIndex
CREATE INDEX "lesson_question_threads_mock_exam_id_idx" ON "lesson_question_threads"("mock_exam_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_library_lesson_id_key" ON "lesson_question_threads"("user_id", "library_lesson_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_chapter_id_key" ON "lesson_question_threads"("user_id", "chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_goal_id_key" ON "lesson_question_threads"("user_id", "goal_id");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_question_threads_user_id_mock_exam_id_key" ON "lesson_question_threads"("user_id", "mock_exam_id");

-- CreateIndex
CREATE INDEX "lesson_questions_library_step_id_idx" ON "lesson_questions"("library_step_id");

-- CreateIndex
CREATE INDEX "lesson_questions_shared_answer_id_idx" ON "lesson_questions"("shared_answer_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_learning_profiles_active_goal_id_key" ON "user_learning_profiles"("active_goal_id");

-- CreateIndex
CREATE INDEX "users_is_anonymous_created_at_idx" ON "users"("is_anonymous", "created_at");

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evaluation_runs" ADD CONSTRAINT "evaluation_runs_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_block_id_fkey" FOREIGN KEY ("block_id") REFERENCES "study_session_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exams" ADD CONSTRAINT "mock_exams_exam_blueprint_id_fkey" FOREIGN KEY ("exam_blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mock_exam_answers" ADD CONSTRAINT "mock_exam_answers_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_results" ADD CONSTRAINT "exam_results_exam_blueprint_id_fkey" FOREIGN KEY ("exam_blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_feedback" ADD CONSTRAINT "content_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_exam_blueprint_id_fkey" FOREIGN KEY ("exam_blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_primary_course_id_fkey" FOREIGN KEY ("primary_course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plans" ADD CONSTRAINT "plans_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_items" ADD CONSTRAINT "plan_items_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_changes" ADD CONSTRAINT "plan_changes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggested_goals" ADD CONSTRAINT "suggested_goals_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_skill_levels" ADD CONSTRAINT "language_skill_levels_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_words" ADD CONSTRAINT "learner_words_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_reviews" ADD CONSTRAINT "pronunciation_reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pronunciation_reviews" ADD CONSTRAINT "pronunciation_reviews_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_conversations" ADD CONSTRAINT "language_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_conversations" ADD CONSTRAINT "language_conversations_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_conversations" ADD CONSTRAINT "language_conversations_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "language_conversations" ADD CONSTRAINT "language_conversations_study_block_id_fkey" FOREIGN KEY ("study_block_id") REFERENCES "study_session_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_scenarios" ADD CONSTRAINT "conversation_scenarios_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_patterns" ADD CONSTRAINT "mistake_patterns_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistake_patterns" ADD CONSTRAINT "mistake_patterns_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_skills" ADD CONSTRAINT "learner_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_skills" ADD CONSTRAINT "learner_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mistakes" ADD CONSTRAINT "mistakes_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_library_lesson_id_fkey" FOREIGN KEY ("library_lesson_id") REFERENCES "library_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_question_threads" ADD CONSTRAINT "lesson_question_threads_mock_exam_id_fkey" FOREIGN KEY ("mock_exam_id") REFERENCES "mock_exams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_library_step_id_fkey" FOREIGN KEY ("library_step_id") REFERENCES "library_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_questions" ADD CONSTRAINT "lesson_questions_shared_answer_id_fkey" FOREIGN KEY ("shared_answer_id") REFERENCES "tutor_shared_answers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tutor_shared_answers" ADD CONSTRAINT "tutor_shared_answers_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_chapters" ADD CONSTRAINT "library_chapters_home_course_id_fkey" FOREIGN KEY ("home_course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_chapters" ADD CONSTRAINT "library_chapters_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_chapters" ADD CONSTRAINT "course_chapters_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_skills" ADD CONSTRAINT "chapter_skills_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_skills" ADD CONSTRAINT "chapter_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_lessons" ADD CONSTRAINT "library_lessons_home_chapter_id_fkey" FOREIGN KEY ("home_chapter_id") REFERENCES "library_chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_lessons" ADD CONSTRAINT "library_lessons_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_lessons" ADD CONSTRAINT "chapter_lessons_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "library_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_lessons" ADD CONSTRAINT "chapter_lessons_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_media_asset_id_fkey" FOREIGN KEY ("media_asset_id") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_steps" ADD CONSTRAINT "library_steps_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_variants" ADD CONSTRAINT "step_variants_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_example_lines" ADD CONSTRAINT "step_example_lines_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_example_lines" ADD CONSTRAINT "step_example_lines_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_facts" ADD CONSTRAINT "memory_facts_superseded_by_id_fkey" FOREIGN KEY ("superseded_by_id") REFERENCES "memory_facts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_insights" ADD CONSTRAINT "memory_insights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memory_insights" ADD CONSTRAINT "memory_insights_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instrument_waitlist_entries" ADD CONSTRAINT "instrument_waitlist_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "onboarding_drafts" ADD CONSTRAINT "onboarding_drafts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_merged_into_id_fkey" FOREIGN KEY ("merged_into_id") REFERENCES "skills"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skills" ADD CONSTRAINT "skills_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "skill_prerequisites" ADD CONSTRAINT "skill_prerequisites_prerequisite_id_fkey" FOREIGN KEY ("prerequisite_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_skills" ADD CONSTRAINT "lesson_skills_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_skills" ADD CONSTRAINT "lesson_skills_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_skill_id_fkey" FOREIGN KEY ("skill_id") REFERENCES "skills"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_exam_blueprint_id_fkey" FOREIGN KEY ("exam_blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_explanations" ADD CONSTRAINT "answer_explanations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "answer_explanations" ADD CONSTRAINT "answer_explanations_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "library_steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sources" ADD CONSTRAINT "sources_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exam_blueprints" ADD CONSTRAINT "exam_blueprints_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_sources" ADD CONSTRAINT "learner_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_sources" ADD CONSTRAINT "learner_sources_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learner_sources" ADD CONSTRAINT "learner_sources_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_change_notices" ADD CONSTRAINT "source_change_notices_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_change_notices" ADD CONSTRAINT "source_change_notices_exam_blueprint_id_fkey" FOREIGN KEY ("exam_blueprint_id") REFERENCES "exam_blueprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_review_flags" ADD CONSTRAINT "content_review_flags_notice_id_fkey" FOREIGN KEY ("notice_id") REFERENCES "source_change_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_review_flags" ADD CONSTRAINT "content_review_flags_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_review_flags" ADD CONSTRAINT "content_review_flags_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_events" ADD CONSTRAINT "learning_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_blocks" ADD CONSTRAINT "study_session_blocks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "study_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_blocks" ADD CONSTRAINT "study_session_blocks_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usage_records" ADD CONSTRAINT "usage_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_learning_profiles" ADD CONSTRAINT "user_learning_profiles_active_goal_id_fkey" FOREIGN KEY ("active_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "guardian_links" ADD CONSTRAINT "guardian_links_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_words" ADD CONSTRAINT "lesson_words_word_id_fkey" FOREIGN KEY ("word_id") REFERENCES "words"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "library_lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_sentences" ADD CONSTRAINT "lesson_sentences_sentence_id_fkey" FOREIGN KEY ("sentence_id") REFERENCES "sentences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Library text search. Prisma's schema can't express SQL functions or expression indexes, so they
-- live here: one search vector per language, accent-insensitive, used by the Library's identity search.

CREATE FUNCTION public.library_search_config(language text) RETURNS regconfig
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN CASE split_part(lower(language), '-'::text, 1) WHEN 'da'::text THEN 'danish'::regconfig WHEN 'de'::text THEN 'german'::regconfig WHEN 'en'::text THEN 'english'::regconfig WHEN 'es'::text THEN 'spanish'::regconfig WHEN 'fi'::text THEN 'finnish'::regconfig WHEN 'fr'::text THEN 'french'::regconfig WHEN 'hu'::text THEN 'hungarian'::regconfig WHEN 'it'::text THEN 'italian'::regconfig WHEN 'nb'::text THEN 'norwegian'::regconfig WHEN 'nl'::text THEN 'dutch'::regconfig WHEN 'no'::text THEN 'norwegian'::regconfig WHEN 'pt'::text THEN 'portuguese'::regconfig WHEN 'ro'::text THEN 'romanian'::regconfig WHEN 'ru'::text THEN 'russian'::regconfig WHEN 'sv'::text THEN 'swedish'::regconfig WHEN 'tr'::text THEN 'turkish'::regconfig ELSE 'simple'::regconfig END;

CREATE FUNCTION public.library_search_vector(language text, parts text[]) RETURNS tsvector
    LANGUAGE sql IMMUTABLE PARALLEL SAFE
    RETURN (to_tsvector(public.library_search_config(language), array_to_string(parts, ' '::text)) || to_tsvector(public.library_search_config(language), translate(lower(array_to_string(parts, ' '::text)), 'áàâãäåāăąçćčďéèêëēėęěíìîïīįñńňóòôõöōőŕřśšşťúùûüūůűųýÿźžż'::text, 'aaaaaaaaacccdeeeeeeeeiiiiiinnnooooooorrssstuuuuuuuuyyzzz'::text)));

CREATE INDEX courses_search_idx ON public.courses USING gin (public.library_search_vector((language)::text, ARRAY[title, normalized_title, description]));

CREATE INDEX exam_blueprints_search_idx ON public.exam_blueprints USING gin (public.library_search_vector((language)::text, ARRAY[name, board, role, replace(identity_key, '-'::text, ' '::text)])) WHERE (visibility = 'public'::public."LibraryVisibility");

CREATE INDEX library_chapters_search_idx ON public.library_chapters USING gin (public.library_search_vector((language)::text, (ARRAY[title, normalized_title, description] || objectives)));

CREATE INDEX library_lessons_search_idx ON public.library_lessons USING gin (public.library_search_vector((language)::text, ARRAY[title, normalized_title, description, can_do]));

CREATE INDEX media_assets_scene_search_idx ON public.media_assets USING gin (public.library_search_vector('en'::text, ARRAY[prompt])) WHERE ((kind = 'image'::public."MediaKind") AND (visibility = 'public'::public."LibraryVisibility") AND (prompt IS NOT NULL));

CREATE INDEX skills_search_idx ON public.skills USING gin (public.library_search_vector((language)::text, ARRAY[name, normalized_name, description]));

CREATE INDEX sources_search_idx ON public.sources USING gin (public.library_search_vector((language)::text, ARRAY[title, publisher, url]));

-- A review flag points at exactly one lesson or one item.

ALTER TABLE "content_review_flags" ADD CONSTRAINT "content_review_flags_one_target_check" CHECK ((("lesson_id" IS NULL) <> ("item_id" IS NULL)));
