import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "./generated/prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

attachDatabasePool(pool);

const adapter = new PrismaPg(pool);

/**
 * A query waits for a free connection as long as it takes, but Prisma gives a transaction only 2s
 * to get one. Work that shares the pool side by side, like a course outline saving its chapters
 * in parallel, can queue longer than that, so a transaction gets up to 10s.
 */
const prisma =
  globalThis.prisma ?? new PrismaClient({ adapter, transactionOptions: { maxWait: 10_000 } });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/** @public */
export type {
  AnswerExplanation,
  Attempt,
  Chapter,
  ChapterLesson,
  ContentFeedback,
  Course,
  CourseCategory,
  CourseChapter,
  CoursePrompt,
  DailyProgress,
  EvaluationRun,
  ExamBlueprint,
  Feedback,
  GenerationStatus,
  Goal,
  GuardianLink,
  InstrumentWaitlistEntry,
  Item,
  LanguageConversation,
  LanguageLevelTest,
  LearnerSkill,
  LearnerSource,
  LearningEvent,
  Lesson,
  LessonQuestion,
  LessonQuestionContextKind,
  LessonQuestionStatus,
  LessonQuestionThread,
  LessonSkill,
  MediaAsset,
  MemoryFact,
  MemoryInsight,
  Milestone,
  Mistake,
  MockExam,
  MockExamAnswer,
  OnboardingDraft,
  Organization,
  Plan,
  PlanChange,
  PlanItem,
  PronunciationReview,
  Skill,
  SkillPrerequisite,
  Source,
  SourceChangeNotice,
  Step,
  StepVariant,
  StudySession,
  StudySessionBlock,
  Subscription,
  SuggestedGoal,
  TutorSharedAnswer,
  User,
  UsageRecord,
  UserLearningProfile,
  UserProgress,
} from "./generated/prisma/client";

export {
  BuddyGlasses,
  BuddyKind,
  ContentFeedbackReason,
  CourseFormat,
  CourseLevel,
  CoursePromptIntent,
  ExperienceMode,
  FeedbackContentKind,
  FeedbackStatus,
  GoalKind,
  GoalStatus,
  GuardianLinkStatus,
  ItemFormat,
  LanguageConversationKind,
  LanguageSkill,
  LearnerSourceOrigin,
  LearningEventKind,
  LibraryVisibility,
  MasteryState,
  MediaKind,
  MemoryCategory,
  MemoryFactStatus,
  MemoryInsightKind,
  MemoryInsightStatus,
  MemoryOrigin,
  MilestoneKind,
  MistakeCause,
  MistakeStatus,
  PlanChangeStatus,
  PlanItemKind,
  PlanItemStatus,
  ResearchUploadReason,
  SourceKind,
  StepKind,
  StudyBlockKind,
  StudyBlockStatus,
  StudyFreshStart,
  StudySessionStatus,
  SuggestedGoalStatus,
  UsageKind,
  VoteValue,
} from "./generated/prisma/client";

export type {
  CoursePromptGetPayload,
  CoursePromptWhereInput,
} from "./generated/prisma/models/CoursePrompt";
export type { CourseGetPayload } from "./generated/prisma/models/Course";
export type { LessonQuestionGetPayload } from "./generated/prisma/models/LessonQuestion";
export type { LessonQuestionThreadGetPayload } from "./generated/prisma/models/LessonQuestionThread";

export { prisma };
export const sql = Prisma.sql;
export type Sql = Prisma.Sql;

/** Writes SQL NULL to a nullable JSON column (a plain `null` means JSON null to Prisma). */
export const DbNull = Prisma.DbNull;

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export { isPrismaForeignKeyError, isPrismaUniqueConstraintError } from "./prisma-errors";

export { getPublishedCourseWhere } from "./curriculum-filters";
