import "server-only";
import { AnyNull, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { mistakePatternContentSchema } from "./pattern-contract";

const FRESH_DAYS = 7;

/**
 * A pattern belongs to the goal that noticed it; once that goal is paused, finished or removed,
 * another goal of its language may offer it.
 */
function offeredToGoal(goalId: string) {
  return { OR: [{ goalId }, { goalId: null }, { goal: { status: { not: "active" as const } } }] };
}

function findFreshPatternRow({
  goalId,
  kind,
  language,
  mistakeIds,
  now = new Date(),
  userId,
  withDrill = false,
}: {
  goalId?: string;
  kind?: "pattern";
  language: string;
  mistakeIds?: readonly string[];
  now?: Date;
  userId: string;
  withDrill?: boolean;
}) {
  return prisma.mistakePattern.findFirst({
    orderBy: { createdAt: "desc" },
    select: { content: true, createdAt: true, id: true, kind: true, mistakeIds: true, title: true },
    where: {
      ...(withDrill && { content: { not: AnyNull, path: ["drill", "0"] } }),
      createdAt: { gte: new Date(now.getTime() - FRESH_DAYS * MS_PER_DAY) },
      dismissedAt: null,
      ...(goalId ? offeredToGoal(goalId) : {}),
      ...(kind ? { kind } : {}),
      language,
      practicedAt: null,
      userId,
      ...(mistakeIds ? { mistakeIds: { hasSome: [...mistakeIds] } } : {}),
    },
  });
}

type PatternQuery = Omit<Parameters<typeof findFreshPatternRow>[0], "kind" | "withDrill">;

export async function findFreshMistakePattern(input: PatternQuery) {
  const pattern = await findFreshPatternRow(input);
  return pattern ? { id: pattern.id, kind: pattern.kind, title: pattern.title } : null;
}

export async function findFreshMistakePatternWithDrill(input: PatternQuery) {
  const pattern = await findFreshPatternRow({ ...input, kind: "pattern", withDrill: true });
  return pattern && mistakePatternContentSchema.safeParse(pattern.content).success ? pattern : null;
}
