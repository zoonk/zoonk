import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { type ActivitySteps, parseActivitySteps } from "./get-activity-steps";

/**
 * Fetches existing static content steps for a completed activity from the database.
 * Used when a completed activity's content is needed by downstream workflows
 * (e.g., practice/quiz need explanation steps). Instead of re-generating,
 * we read what was already persisted.
 */
export async function getExistingContentSteps(activityId: string): Promise<ActivitySteps> {
  "use step";
  const { data: existingSteps } = await safeAsync(() =>
    prisma.step.findMany({
      orderBy: { position: "asc" },
      select: { content: true },
      where: { activityId, kind: "static" },
    }),
  );

  if (!existingSteps?.length) {
    return [];
  }

  try {
    return parseActivitySteps(existingSteps);
  } catch {
    return [];
  }
}
