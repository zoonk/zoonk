import "server-only";
import { createHash } from "node:crypto";
import { MemoryCategory, prisma } from "@zoonk/db";
import { getMemoryForTask } from "../../../memory/get-memory-for-task";

/**
 * Example lines read everything memory keeps about the learner (owner, 7 Oct 2026: "examples
 * should use everything we know about the user"): their background, routine (a commute, a night
 * shift), the life around them, what they aim for, the examples they like and how they learn. A
 * moment from any of them can make an idea theirs; the model leaves out what doesn't fit.
 */
const EXAMPLE_LINE_CATEGORIES = Object.values(MemoryCategory);

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
 * What an example line may use about one learner: the facts memory hands to tasks, of every kind
 * (the most recent, never sensitive ones, none while memory is off, and for minors only the goals
 * and learning their memory keeps), and the title of the goal they study for.
 * Memory is read without a search, so the same facts give the same key and the cached line stays.
 * Null without such facts: a line built from the goal's name alone is filler ("While studying for
 * ENEM 2026, …"), so no model runs.
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

  if (facts.length === 0) {
    return null;
  }

  return { facts, goal, key: hashContext({ facts, goal }) };
}
