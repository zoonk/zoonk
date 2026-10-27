import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Prisma, PrismaClient } from "./generated/prisma/client";
import { createDatabasePool } from "./pool";

declare global {
  var prisma: PrismaClient | undefined;
}

const pool = createDatabasePool(process.env.DATABASE_URL);

attachDatabasePool(pool);

const adapter = new PrismaPg(pool);
const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/** @public */
export type {
  AnswerExplanation,
  Attempt,
  Chapter,
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
  FreeCallSpendDay,
  GenerationStatus,
  Goal,
  InstrumentWaitlistEntry,
  Item,
  ItemSet,
  LanguageConversation,
  LanguageLevelTest,
  LanguageSkillLevel,
  LearnerSkill,
  LearnerSource,
  LearningEvent,
  Lesson,
  LessonQuestion,
  LessonQuestionContextKind,
  LessonQuestionStatus,
  LessonQuestionThread,
  LessonSkill,
  LiveCallConnection,
  LiveCallSetting,
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
  StepExampleLine,
  StepOptionPicture,
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
  SourceKind,
  StepKind,
  StudyBlockKind,
  StudyBlockStatus,
  StudyFreshStart,
  StudySessionStatus,
  SuggestedGoalStatus,
  UsageKind,
} from "./generated/prisma/client";

export type { AiCallCreateManyInput } from "./generated/prisma/models/AiCall";
export type { CourseGetPayload } from "./generated/prisma/models/Course";
export type { LessonUncheckedCreateInput } from "./generated/prisma/models/Lesson";
export type {
  LessonQuestionGetPayload,
  LessonQuestionWhereInput,
} from "./generated/prisma/models/LessonQuestion";
export type { LessonQuestionThreadGetPayload } from "./generated/prisma/models/LessonQuestionThread";

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
