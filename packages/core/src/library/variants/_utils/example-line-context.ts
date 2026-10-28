import "server-only";
import { createHash } from "node:crypto";
import { MemoryCategory, prisma } from "@zoonk/db";
import { findMemoryForTask } from "../../../memory/get-memory-for-task";

const EXAMPLE_LINE_CATEGORIES = Object.values(MemoryCategory);

export type ExampleLineContext = {
  facts: { id: string; statement: string }[];
  goal: string | null;
  key: string;
};

function hashContext({ facts, goal }: Pick<ExampleLineContext, "facts" | "goal">): string {
  const statements = facts.map((fact) => fact.statement).toSorted();
  return createHash("sha256").update(JSON.stringify({ goal, statements })).digest("hex");
}

export async function loadExampleLineContext({
  language,
  userId,
}: {
  language: string;
  userId: string;
}): Promise<ExampleLineContext | null> {
  const [profile, facts] = await Promise.all([
    prisma.userLearningProfile.findUnique({ include: { activeGoal: true }, where: { userId } }),
    findMemoryForTask({ categories: EXAMPLE_LINE_CATEGORIES, language, userId }),
  ]);

  const goal = profile?.activeGoal?.status === "active" ? profile.activeGoal.title : null;

  if (facts.length === 0) {
    return null;
  }

  return { facts, goal, key: hashContext({ facts, goal }) };
}
