import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { getString } from "@zoonk/utils/json";
import { after } from "next/server";
import { type OnboardingProgress } from "./onboarding-progress";
import { type AnalyticsPlatform } from "./shared-properties";
import { trackLearnerEvents } from "./track-learner-event";

/** Internal analytics: reads ownership after the response, without delaying the learner's work. */
export function trackOnboardingProgress({
  goalId,
  platform,
  ...progress
}: Omit<OnboardingProgress, "goal_id" | "onboarding_id"> & {
  goalId: string;
  platform?: AnalyticsPlatform | null;
}): void {
  after(async () => {
    await safeAsync(async () => {
      const goal = await prisma.goal.findUnique({ where: { id: goalId } });

      if (!goal) {
        return;
      }

      await trackLearnerEvents({
        events: [
          {
            name: "Onboarding Progressed",
            properties: {
              ...progress,
              goal_id: goal.id,
              onboarding_id: getString(goal.details, "onboardingId") ?? undefined,
            },
          },
        ],
        goalId,
        platform,
        userId: goal.userId,
      });
    });
  });
}
