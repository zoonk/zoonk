import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { getSession } from "../../users/get-session";
import { type MistakePatternView, mistakePatternContentSchema } from "./pattern-contract";

export type MistakePatternResult =
  | { pattern: MistakePatternView; status: "ready" }
  | { status: "notFound" | "unauthorized" };

/** One of the learner's own patterns, with the rule, the mistakes that showed it and the drill. */
export async function findOwnedPattern({
  patternId,
  userId,
}: {
  patternId: string;
  userId: string;
}) {
  if (!isUuid(patternId)) {
    return null;
  }

  const row = await prisma.mistakePattern.findFirst({ where: { id: patternId, userId } });
  const content = mistakePatternContentSchema.safeParse(row?.content);

  return row && content.success ? { content: content.data, row } : null;
}

/**
 * "We noticed a pattern": a rule behind several of the learner's recent mistakes, the mistakes
 * that show it, and a three-minute drill. Or the kind note that they were only typos.
 */
export async function getMistakePattern(patternId: string): Promise<MistakePatternResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const owned = await findOwnedPattern({ patternId, userId: session.user.id });

  if (!owned) {
    return { status: "notFound" };
  }

  const { content, row } = owned;

  return {
    pattern: {
      ...content,
      id: row.id,
      kind: row.kind,
      occurrences: content.examples.length,
      practiced: row.practicedAt !== null,
      title: row.title,
    },
    status: "ready",
  };
}
