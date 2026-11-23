import { LearnNoGoal } from "@/app/[lang]/(app)/(learn)/_components/learn-no-goal";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { redirect } from "@/i18n/navigation";
import { LEVEL_TEST_OUT_PARAM } from "@/lib/placement-test/level-check-href";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { getGoalPlan } from "@zoonk/core/plans/get";
import { OnboardingPage } from "@zoonk/learn/onboarding/frame";
import { FocusTestSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LevelTestClient } from "./level-test-client";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Level test") };
}

type Props = PageProps<"/[lang]/level-test">;

async function LevelTestContent({ searchParams }: Props) {
  const [locale, list, query] = await Promise.all([lang(), listCurrentUserGoals(), searchParams]);
  const goal = list?.goals.find((candidate) => candidate.id === list.activeGoalId) ?? null;

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<JourneyPageBar root />}
        description={t("Find your level and skip what you know")}
        next="/level-test"
        title={t("Level test")}
      />
    );
  }

  const plan = await getGoalPlan(goal.id);
  const test = plan.status === "ready" ? plan.plan.placementTest : null;

  if (test?.kind !== "language" || !goal.targetLanguage) {
    redirect({ href: "/plan", locale });
    return null;
  }

  // A whole-course test past its level check goes on through the course's topics.
  if (test.attempt) {
    redirect({ href: "/placement-test", locale });
    return null;
  }

  return (
    <OnboardingPage backHref="/plan">
      <LevelTestClient
        goalId={goal.id}
        testOutFirst={query[LEVEL_TEST_OUT_PARAM] !== undefined}
        targetLanguage={goal.targetLanguage}
        testOutLevel={test.nextTestOutLevel}
        wholeCourseMinutes={test.estimatedMinutes}
      />
    </OnboardingPage>
  );
}

export default function LevelTestPage(props: Props) {
  return (
    <Suspense
      fallback={
        <OnboardingPage backHref="/plan">
          <FocusTestSkeleton />
        </OnboardingPage>
      }
    >
      <LevelTestContent {...props} />
    </Suspense>
  );
}
