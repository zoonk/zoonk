import { LearnNoGoal } from "@/app/[lang]/(app)/(learn)/_components/learn-no-goal";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { redirect } from "@/i18n/navigation";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { OnboardingPage } from "@zoonk/learn/onboarding/frame";
import { getGoalSubject } from "@zoonk/learn/onboarding/goal-subject";
import { FocusTestSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { PlacementTestClient } from "./placement-test-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Test what you know") };
}

async function PlacementTestContent() {
  const [locale, list] = await Promise.all([lang(), listCurrentUserGoals()]);
  const goal = list?.goals.find((candidate) => candidate.isActive) ?? null;

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<JourneyPageBar root />}
        description={t("Skip lessons you already know")}
        next="/placement-test"
        title={t("Test what you know")}
      />
    );
  }

  if (goal.kind === "exam") {
    redirect({ href: "/focus-test", locale });
    return null;
  }

  const plan = await getGoalPlan(goal.id);
  const test = plan.status === "ready" ? plan.plan.placementTest : null;

  if (test?.kind !== "learn") {
    redirect({ href: "/plan", locale });
    return null;
  }

  return (
    <OnboardingPage backHref="/plan">
      <PlacementTestClient
        goalId={goal.id}
        subject={getGoalSubject(goal, locale)}
        wholeCourseMinutes={test.estimatedMinutes}
      />
    </OnboardingPage>
  );
}

export default function PlacementTestPage() {
  return (
    <Suspense
      fallback={
        <OnboardingPage backHref="/plan">
          <FocusTestSkeleton />
        </OnboardingPage>
      }
    >
      <PlacementTestContent />
    </Suspense>
  );
}
