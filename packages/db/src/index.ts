import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

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
  ContentManagementMode,
  Activity,
  ActivityKind,
  ActivityProgress,
  Chapter,
  Course,
  CourseAlternativeTitle,
  CourseCategory,
  CourseSuggestion,
  CourseUser,
  GenerationStatus,
  Lesson,
  LessonKind,
  LessonSentence,
  LessonWord,
  Member,
  Organization,
  Sentence,
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

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export {
  getActiveActivityWhere,
  getActiveChapterWhere,
  getActiveCourseWhere,
  getActiveLessonWhere,
  getPublishedActivityWhere,
  getPublishedChapterWhere,
  getPublishedCourseWhere,
  getPublishedLessonWhere,
  getPublishedStepWhere,
} from "./curriculum-filters";
