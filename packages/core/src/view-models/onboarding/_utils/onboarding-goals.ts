import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";

function readDetail(details: unknown, key: string): string | null {
  const value = isJsonObject(details) ? details[key] : null;
  return typeof value === "string" ? value : null;
}

/**
 * The goals typed together in one onboarding ("ENEM and English" share its id), which share the
 * day's time, in order: the main one first. Archived goals don't count (started over, or moved):
 * the exam goal a language goal moved to takes that goal's place.
 */
export async function findOnboardingGoalIds(
  goal: Pick<Goal, "details" | "id" | "userId">,
): Promise<string[]> {
  const onboardingId = readDetail(goal.details, "onboardingId");

  if (!onboardingId) {
    return [goal.id];
  }

  const goals = await prisma.goal.findMany({
    orderBy: { createdAt: "asc" },
    select: { details: true, id: true, status: true },
    where: { details: { equals: onboardingId, path: ["onboardingId"] }, userId: goal.userId },
  });

  const places = new Map(goals.map((item, index) => [item.id, index]));

  const place = (item: (typeof goals)[number]) =>
    places.get(readDetail(item.details, "movedFromGoalId") ?? "") ?? places.get(item.id) ?? 0;

  const live = goals
    .filter((item) => item.status !== "archived")
    .toSorted((first, second) => place(first) - place(second));

  return live.length > 0 ? live.map((item) => item.id) : [goal.id];
}
