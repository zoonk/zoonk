import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@zoonk/db";
import { getMemoryForTask } from "../../../memory/get-memory-for-task";

/** Example lines read only what the learner shared about their background and preferences. */
const EXAMPLE_LINE_CATEGORIES = ["background", "preferences"] as const;

export type ExampleLineContext = {
  facts: { id: string; statement: string }[];
  goal: string | null;
  /** Changes whenever the facts or goal change, so a stale line is written again. */
  key: string;
};

function hashContext({ facts, goal }: Pick<ExampleLineContext, "facts" | "goal">): string {
  const statements = facts.map((fact) => fact.statement).toSorted();
  return createHash("sha256").update(JSON.stringify({ goal, statements })).digest("hex");
}

/**
 * What an example line may use about one learner: the background and preference facts memory
 * hands to tasks (the most recent, never sensitive ones, none while memory is off, and none for
 * minors, whose memory keeps only goals and learning), and the title of the goal they study for.
 * Memory is read without a search, so the same facts give the same key and the cached line stays.
 * Null when there's nothing to tie an idea to, so no model runs.
 */
export async function loadExampleLineContext({
  language,
  userId,
}: {
  language: string;
  userId: string;
}): Promise<ExampleLineContext | null> {
  const [profile, facts] = await Promise.all([
    prisma.userLearningProfile.findUnique({ include: { activeGoal: true }, where: { userId } }),
    getMemoryForTask({ categories: EXAMPLE_LINE_CATEGORIES, language, userId }),
  ]);

  const goal = profile?.activeGoal?.status === "active" ? profile.activeGoal.title : null;

  if (facts.length === 0 && !goal) {
    return null;
  }

  return { facts, goal, key: hashContext({ facts, goal }) };
}
