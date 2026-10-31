import "server-only";
import { prisma } from "@zoonk/db";
import { isAdult } from "@zoonk/utils/age";

export type LearnerAnalyticsPolicy = "anonymous" | "identified" | "off";

/**
 * Nothing about the learner is sent once they turn usage data off, and only adults get a person
 * profile. Without a country (a workflow step), the oldest adult age anywhere applies.
 */
export function getLearnerAnalyticsPolicy({
  birthYear,
  country,
  shareUsageData,
}: {
  birthYear: number | null;
  country: string | null;
  shareUsageData: boolean | null;
}): LearnerAnalyticsPolicy {
  if (shareUsageData === false) {
    return "off";
  }

  return isAdult({ birthYear, country, now: new Date() }) ? "identified" : "anonymous";
}

export async function loadLearnerAnalyticsPolicy({
  country,
  userId,
}: {
  country: string | null;
  userId: string;
}): Promise<LearnerAnalyticsPolicy> {
  const profile = await prisma.userLearningProfile.findUnique({
    select: { birthYear: true, shareUsageData: true },
    where: { userId },
  });

  return getLearnerAnalyticsPolicy({
    birthYear: profile?.birthYear ?? null,
    country,
    shareUsageData: profile?.shareUsageData ?? null,
  });
}
