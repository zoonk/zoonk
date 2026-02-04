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

export type {
  Account,
  Activity,
  ActivityKind,
  ActivityProgress,
  Chapter,
  Course,
  CourseAlternativeTitle,
  CourseCategory,
  CourseSuggestion,
  CourseUser,
  DailyProgress,
  GenerationStatus,
  Invitation,
  Lesson,
  LessonKind,
  Member,
  Organization,
  RateLimit,
  SearchPrompt,
  SearchPromptSuggestion,
  Session,
  Step,
  StepAttempt,
  StepKind,
  StepVisualKind,
  Subscription,
  User,
  UserProgress,
  Verification,
} from "./generated/prisma/client";

export type { BatchPayload } from "./generated/prisma/internal/prismaNamespace";

export { prisma };

export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
