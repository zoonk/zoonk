import { LearnNoGoal } from "@/app/[lang]/(app)/(learn)/_components/learn-no-goal";
import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { redirect } from "@/i18n/navigation";
import { FOCUS_TEST_GOAL_PARAM, FOCUS_TEST_STARTED_PARAM } from "@/lib/focus-test/focus-test-href";
import { type GoalView } from "@zoonk/core/goals/contract";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { OnboardingPage } from "@zoonk/learn/onboarding/frame";
import { getGoalSubject } from "@zoonk/learn/onboarding/goal-subject";
import { FocusTestSkeleton } from "@zoonk/learn/onboarding/skeletons";
import { isUuid } from "@zoonk/utils/uuid";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { FocusTestClient } from "./focus-test-client";

type Props = PageProps<"/[lang]/focus-test">;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { robots: { follow: false, index: false }, title: t("Focus test") };
}

/** A goal named in the address is the one being set up; otherwise the test is the current goal's. */
function findGoal({
  goals,
  named,
}: {
  goals: readonly GoalView[];
  named: string | null;
}): GoalView | null {
  return goals.find((goal) => (named ? goal.id === named : goal.isActive)) ?? null;
}

async function FocusTestContent({ searchParams }: Props) {
  const [locale, query, list] = await Promise.all([lang(), searchParams, listCurrentUserGoals()]);
  const param = query[FOCUS_TEST_GOAL_PARAM];
  const named = typeof param === "string" && isUuid(param) ? param : null;
  const goal = findGoal({ goals: list?.goals ?? [], named });

  if (!goal) {
    const t = await getExtracted();

    return (
      <LearnNoGoal
        bar={<JourneyPageBar root />}
        description={t("Quick questions that find where your study time should go")}
        next="/focus-test"
        title={t("Focus test")}
      />
    );
  }

  // Only an exam goal has the test; any other chooses its focus on the plan.
  if (goal.kind !== "exam") {
    redirect({ href: "/plan?focus=choose", locale });
    return null;
  }

  // The goal still being set up goes back to its plan's reveal, where the test was offered.
  const backHref = named ? (`/start/${goal.id}` as const) : "/plan";

  return (
    <OnboardingPage backHref={backHref}>
      <FocusTestClient
        backHref={backHref}
        goalId={goal.id}
        started={query[FOCUS_TEST_STARTED_PARAM] !== undefined}
        subject={getGoalSubject(goal)}
      />
    </OnboardingPage>
  );
}

export default function FocusTestPage(props: Props) {
  return (
    <Suspense
      fallback={
        <OnboardingPage backHref="/plan">
          <FocusTestSkeleton />
        </OnboardingPage>
      }
    >
      <FocusTestContent {...props} />
    </Suspense>
  );
}
