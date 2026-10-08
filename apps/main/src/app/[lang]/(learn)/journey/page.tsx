import { getPathname, redirect } from "@/i18n/navigation";
import { skipAlphabetAction } from "@/lib/language/skip-alphabet-action";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { lang } from "next/root-params";
import { Suspense } from "react";
import { LearnNoGoal } from "../_components/learn-no-goal";
import {
  changePlanAction,
  choosePlanToolsAction,
  continueNextLevelAction,
  decidePlanChangeAction,
} from "./journey-actions";
import { JourneyBuildingClient, JourneyClient } from "./journey-client";
import { JourneySetup } from "./journey-setup";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Journey") };
}

/** What to study next once every lesson of the plan is done; read only then. */
async function loadStudyNext({ finished, goalId }: { finished: boolean; goalId: string }) {
  if (!finished) {
    return null;
  }

  const result = await getFieldMapView({ goalId });
  return result.status === "ready" ? result.map.next : null;
}

/** The goal's status for its "…": the goal on the Journey is never an archived one. */
function getGoalStatus(goal: { status: string } | null) {
  return goal?.status === "paused" || goal?.status === "completed" ? goal.status : "active";
}

/** The goal in the switcher, as the goal list has it, and whether the learner studies anything. */
function findActiveGoal(list: Awaited<ReturnType<typeof listCurrentUserGoals>>) {
  const goal = list?.goals.find((candidate) => candidate.id === list.activeGoalId) ?? null;
  const hasStudyGoal = Boolean(list?.goals.some((candidate) => candidate.kind !== "explain"));

  return { goal, hasStudyGoal };
}

/**
 * A goal without a plan yet: still in onboarding, its questions are the one way forward; past
 * them, its plan is being built (or its run needs another try), which the Journey follows.
 */
async function JourneyWithoutPlan({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const onboarding = await getOnboarding({ goalId });
  const steps = onboarding.status === "ready" ? onboarding.onboarding.steps : [];

  if (steps.some((step) => step !== "plan")) {
    return <JourneySetup goalId={goalId} />;
  }

  return <JourneyBuildingClient goalId={goalId} goalTitle={goalTitle} />;
}

async function JourneyContent() {
  // Independent cached reads start together, so the tab prefetches in one pass. They all read the
  // active goal. The locale comes from the root param: a prefetch warms its caches with `params`
  // still pending, so reads after `await params` would miss the cache.
  const [result, progress, language, units, syllabus, mindMaps, buddy, locale, goals, readAt] =
    await Promise.all([
      getPlanTabView(),
      getProgressView(),
      getLanguageProgressView(),
      getLanguageUnitsView(),
      getSyllabusView(),
      listGoalMindMaps(),
      getLearnerBuddy(),
      lang(),
      listCurrentUserGoals(),
      getReadAt(),
    ]);

  if (result.status === "noGoal" || result.status === "unauthorized") {
    return <LearnNoGoal />;
  }

  const active = findActiveGoal(goals);

  // A quick explanation is one answer, not a way to a goal: Today holds it next to the learner's
  // other goals, and a learner with only explanations starts a goal, as Today sends them to.
  if (active.goal?.kind === "explain") {
    redirect({ href: active.hasStudyGoal ? "/today" : "/start", locale });
  }

  if (result.status !== "ready" || !result.view.plan.ready) {
    return active.goal ? (
      <JourneyWithoutPlan goalId={active.goal.id} goalTitle={active.goal.title} />
    ) : (
      <LearnNoGoal />
    );
  }

  const { goal, plan } = result.view;

  const next = await loadStudyNext({ finished: plan.finished, goalId: goal.id });
  const standing = progress.status === "ready" ? progress.progress : null;
  const alphabet = units.status === "ready" ? units.units.alphabet : null;

  return (
    <JourneyClient
      actions={{
        change: changePlanAction.bind(null, goal.id),
        chooseTools: choosePlanToolsAction.bind(null, goal.id),
        decide: decidePlanChangeAction.bind(null, goal.id),
      }}
      alphabet={
        alphabet && {
          link: {
            href: `/learn/${alphabet.lessonId}`,
            minutes: alphabet.minutes,
            pending: alphabet.pending,
            title: alphabet.title,
          },
          onSkip: skipAlphabetAction.bind(null, goal.id),
        }
      }
      buddy={buddy}
      goal={{ kind: goal.kind, title: goal.title }}
      goalId={goal.id}
      goalStatus={getGoalStatus(active.goal)}
      hasMindMaps={mindMaps.status === "ready" && mindMaps.mindMaps.chapters.length > 0}
      language={language.status === "ready" ? language.progress : null}
      next={next && { onContinue: continueNextLevelAction.bind(null, goal.id), view: next }}
      plan={plan}
      readAt={readAt}
      preparation={
        standing?.preparation
          ? {
              forExam: goal.kind === "exam",
              kind: "preparation",
              preparation: standing.preparation,
              stillNeeded: standing.stillNeeded,
            }
          : null
      }
      shareHref={getPathname({
        href: `/plan-link/${plan.planId}`,
        locale: getSupportedLocaleFromLanguage(locale),
      })}
      syllabus={syllabus.status === "ready" ? syllabus.syllabus : null}
    />
  );
}

function JourneySkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-30 w-full rounded-3xl" />
      <Skeleton className="h-4 w-28" />
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-2/3 rounded-full" />
        <Skeleton className="h-8 w-3/4 rounded-full" />
        <Skeleton className="ml-11 h-40 w-[calc(100%-2.75rem)] rounded-2xl" />
        <Skeleton className="h-8 w-1/2 rounded-full" />
        <Skeleton className="h-8 w-2/3 rounded-full" />
      </div>
    </div>
  );
}

/**
 * The Journey for the goal in the switcher: where the learner stands, the path of phases to the
 * goal with the current one open, and the goal's structure. It replaces Plan, Progress and Content.
 * A goal without its plan yet shows its way there instead: never a missing page.
 */
export default function JourneyPage() {
  return (
    <Suspense fallback={<JourneySkeleton />}>
      <JourneyContent />
    </Suspense>
  );
}
