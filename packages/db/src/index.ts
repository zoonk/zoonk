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
  Chapter,
  ChapterCompletion,
  ChapterSentence,
  ChapterWord,
  Course,
  CourseCategory,
  CourseCompletion,
  CoursePrompt,
  CourseUser,
  GenerationStatus,
  Lesson,
  LessonProgress,
  LessonKind,
  Member,
  Organization,
  Sentence,
  Subscription,
  StepKind,
  User,
  UserProgress,
  Word,
  WordPronunciation,
} from "./generated/prisma/client";

export { CourseFormat, CoursePromptIntent } from "./generated/prisma/client";

export type { ChapterCreateManyInput } from "./generated/prisma/models/Chapter";
export type { ChapterGetPayload } from "./generated/prisma/models/Chapter";
export type { ChapterSentenceGetPayload } from "./generated/prisma/models/ChapterSentence";
export type { ChapterWordGetPayload } from "./generated/prisma/models/ChapterWord";
export type {
  CoursePromptGetPayload,
  CoursePromptWhereInput,
} from "./generated/prisma/models/CoursePrompt";
export type { CourseGetPayload } from "./generated/prisma/models/Course";
export type { LessonCreateManyInput } from "./generated/prisma/models/Lesson";
export type { LessonGetPayload } from "./generated/prisma/models/Lesson";
export type { StepGetPayload } from "./generated/prisma/models/Step";

export { prisma };
export const sql = Prisma.sql;
export type Sql = Prisma.Sql;

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

export { isPrismaUniqueConstraintError } from "./prisma-errors";

export {
  getAiGenerationChapterWhere,
  getAiGenerationCourseWhere,
  getAiGenerationLessonWhere,
  getPublishedChapterWhere,
  getPublishedCourseWhere,
  getPublishedLessonWhere,
  getPublishedStepWhere,
} from "./curriculum-filters";
