import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Prisma, PrismaClient, UsageKind as StoredUsageKind } from "./generated/prisma/client";
import { getDatabaseUrl, requireCheckoutDatabase } from "./local-database";
import { createDatabasePool } from "./pool";

declare global {
  var prisma: PrismaClient | undefined;
}

const pool = createDatabasePool(requireCheckoutDatabase(getDatabaseUrl()));

attachDatabasePool(pool);

const adapter = new PrismaPg(pool);
const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/** @public */
export type {
  Session,
  AnswerExplanation,
  Attempt,
  Certificate,
  Chapter,
  ContentFix,
  ChapterLesson,
  ChapterMindMap,
  ChapterSkill,
  Course,
  CourseCategory,
  CourseChapter,
  DailyProgress,
  EvaluationRun,
  ExamBlueprint,
  Feedback,
  FollowUp,
  GenerationStatus,
  Goal,
  GoalSource,
  InstrumentWaitlistEntry,
  Item,
  ItemSet,
  LanguageConversation,
  LanguageLevelTest,
  LanguageSkillGraph,
  LanguageSkillLevel,
  LearnerCondition,
  ProfileAnswer,
  LearnerSkill,
  LearnerSource,
  LearningEvent,
  Lesson,
  LessonIcon,
  LessonQuestion,
  LessonQuestionContextKind,
  LessonQuestionStatus,
  LessonQuestionThread,
  LessonSkill,
  LiveCallConnection,
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
  Product,
  ProductRelease,
  PronunciationReview,
  Skill,
  SkillPrerequisite,
  Source,
  SourceChangeNotice,
  Step,
  StepExampleLine,
  StepOptionPicture,
  StepVariant,
  StepVariantGeneration,
  StudySession,
  StudySessionBlock,
  StudyReminder,
  Subscription,
  SuggestedGoal,
  TutorSharedAnswer,
  User,
  UsageRecord,
  UserLearningProfile,
  UserProgress,
  WarmUp,
} from "./generated/prisma/client";

export {
  BuddyGlasses,
  BuddyKind,
  ContentFixStatus,
  ContentFixUnit,
  CourseFormat,
  CourseLevel,
  FeedbackContentKind,
  FeedbackStatus,
  GoalKind,
  GoalStatus,
  ItemFormat,
  ItemSetKind,
  LanguageConversationKind,
  LanguageSkill,
  ProfileQuestion,
  LearnerSourceOrigin,
  LearningEventKind,
  LibraryVisibility,
  LiveCallEndReason,
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
  PlanSetupTask,
  ResearchUploadReason,
  SavedMindMapKind,
  SourceKind,
  StepKind,
  StepVariantKind,
  StudyBlockKind,
  StudyBlockStatus,
  StudyFreshStart,
  StudySessionStatus,
  SuggestedGoalStatus,
} from "./generated/prisma/client";

export type { AiCallCreateManyInput } from "./generated/prisma/models/AiCall";
export type { ContentFixWhereInput } from "./generated/prisma/models/ContentFix";
export type { CourseGetPayload } from "./generated/prisma/models/Course";
export type {
  LessonGetPayload,
  LessonUncheckedCreateInput,
} from "./generated/prisma/models/Lesson";
export type {
  LessonQuestionGetPayload,
  LessonQuestionWhereInput,
} from "./generated/prisma/models/LessonQuestion";
export type { LessonQuestionThreadGetPayload } from "./generated/prisma/models/LessonQuestionThread";
export type { ProductWhereInput } from "./generated/prisma/models/Product";
export type { StepWhereInput } from "./generated/prisma/models/Step";

// Historical mock writing charges remain in the ledger and still count toward actual spend.
const { mockQuestions: _retiredMockQuestions, ...USAGE_KINDS } = StoredUsageKind;
export { USAGE_KINDS };
export type UsageKind = (typeof USAGE_KINDS)[keyof typeof USAGE_KINDS];

export { prisma };
export const sql = Prisma.sql;
export type Sql = Prisma.Sql;

/** Writes SQL NULL to a nullable JSON column (a plain `null` means JSON null to Prisma). */
export const DbNull = Prisma.DbNull;

/** Matches JSON null and SQL NULL alike in a JSON filter, so a path that isn't there reads as null. */
export const AnyNull = Prisma.AnyNull;

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export {
  isPrismaForeignKeyError,
  isPrismaTransactionConflictError,
  isPrismaUniqueConstraintError,
} from "./prisma-errors";

export {
  getCourseRouteWhere,
  getListedCourseWhere,
  getPublishedCourseWhere,
  isListedCourse,
} from "./curriculum-filters";
