import { type ActivityKind, Prisma } from "./generated/prisma/client";
import { type $DbEnums } from "./generated/prisma/sql/$DbEnums";

export const MAX_QUERY_ITEMS = 100;

// Workaround for Prisma TypedSQL bug: $queryRawTyped returns
// the mapped DB values (language_review) but $DbEnums doesn't
// map them back to the Prisma schema names (languageReview).
// https://github.com/prisma/prisma/issues/9877
const dbActivityKindMap: Record<$DbEnums["ActivityKind"], ActivityKind> = {
  background: "background",
  challenge: "challenge",
  custom: "custom",
  examples: "examples",
  explanation: "explanation",
  grammar: "grammar",
  language_review: "languageReview",
  language_story: "languageStory",
  listening: "listening",
  mechanics: "mechanics",
  quiz: "quiz",
  reading: "reading",
  review: "review",
  story: "story",
  vocabulary: "vocabulary",
};

export function toActivityKind(dbValue: $DbEnums["ActivityKind"]): ActivityKind {
  return dbActivityKindMap[dbValue];
}

export function clampQueryItems(count: number): number {
  return Math.min(Math.max(count, 1), MAX_QUERY_ITEMS);
}

/**
 * Check if an error is a Prisma unique constraint violation (P2002).
 */
export function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
