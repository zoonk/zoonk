import { PrismaPg } from "@prisma/adapter-pg";
import { attachDatabasePool } from "@vercel/functions";
import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

attachDatabasePool(pool);

const adapter = new PrismaPg(pool);
const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export type {
  Account,
  Chapter,
  Course,
  CourseAlternativeTitle,
  CourseCategory,
  CourseSuggestion,
  CourseUser,
  Invitation,
  Lesson,
  Member,
  Organization,
  RateLimit,
  Session,
  Subscription,
  User,
  Verification,
} from "./generated/prisma/client";

export { prisma };
