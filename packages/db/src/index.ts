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
const prisma = globalThis.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}

/** @public */
export type {
  ContentReview,
  Activity,
  ActivityKind,
  ActivityProgress,
  Chapter,
  ChapterCompletion,
  Course,
  CourseAlternativeTitle,
  CourseCategory,
  CourseCompletion,
  CourseSuggestion,
  CourseUser,
  GenerationStatus,
  Lesson,
  LessonCompletion,
  LessonKind,
  LessonSentence,
  LessonWord,
  Member,
  Organization,
  Sentence,
  Subscription,
  StepKind,
  Word,
  WordPronunciation,
} from "./generated/prisma/client";

export type { ActivityCreateManyInput } from "./generated/prisma/models/Activity";
export type { ChapterCreateManyInput } from "./generated/prisma/models/Chapter";
export type { CourseGetPayload } from "./generated/prisma/models/Course";
export type { LessonCreateManyInput } from "./generated/prisma/models/Lesson";

export type { BatchPayload } from "./generated/prisma/internal/prismaNamespace";

export { prisma };
export const sql = Prisma.sql;
export type Sql = Prisma.Sql;

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export {
  getAiGenerationActivityWhere,
  getAiGenerationChapterWhere,
  getAiGenerationCourseWhere,
  getAiGenerationLessonWhere,
  getPublishedActivityWhere,
  getPublishedChapterWhere,
  getPublishedCourseWhere,
  getPublishedLessonWhere,
  getPublishedStepWhere,
} from "./curriculum-filters";
