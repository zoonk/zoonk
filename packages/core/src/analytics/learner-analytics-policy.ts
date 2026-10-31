import "server-only";
import { prisma } from "@zoonk/db";
import { isAdult, isKnownMinor } from "@zoonk/utils/age";
import { isUsageDataLockedOff } from "@zoonk/utils/usage-data";

export type LearnerAnalyticsPolicy = "anonymous" | "identified" | "off";

/**
 * Nothing about the learner is sent once they turn usage data off, or about a known minor where the
 * law needs a yes they can't give; only adults get a person profile. Without a country (a workflow
 * step), the oldest adult age anywhere applies, and a minor counts as being where the law needs one.
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
  const now = new Date();

  if (shareUsageData === false) {
    return "off";
  }

  if (isAdult({ birthYear, country, now })) {
    return "identified";
  }

  const minor = isKnownMinor({ birthYear, country, now });
  return isUsageDataLockedOff({ country, minor }) ? "off" : "anonymous";
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
