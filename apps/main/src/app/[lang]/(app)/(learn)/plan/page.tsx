import { getPathname } from "@/i18n/navigation";
import { skipAlphabetAction } from "@/lib/language/skip-alphabet-action";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "@zoonk/core/cache-tags";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { listGoalMindMaps } from "@zoonk/core/mind-maps/list";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { getSession } from "@zoonk/core/users/session";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { type Metadata } from "next";
import { getExtracted } from "next-intl/server";
import { cacheTag } from "next/cache";
import { lang } from "next/root-params";
import { Suspense } from "react";
import {
  changePlanAction,
  chooseExamOptionAction,
  choosePlanToolsAction,
  continueNextLevelAction,
  decidePlanChangeAction,
  previewPlanChangeAction,
} from "./journey-actions";
import { JourneyBuildingClient, JourneyClient } from "./journey-client";
import { JourneySetup } from "./journey-setup";
import { PlanNoGoal } from "./plan-no-goal";
import { PlanSkeleton } from "./plan-skeleton";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted();
  return { title: t("Plan") };
}

/** What to study next once nothing of the plan is left (finished or ended); read only then. */
async function loadStudyNext({ goalId, over }: { goalId: string; over: boolean }) {
  if (!over) {
    return null;
  }

  const result = await getFieldMapView({ goalId });
  return result.status === "ready" ? result.map.next : null;
}

/** The goal's status for its "…": the goal on the Plan is never an archived one. */
function getGoalStatus(goal: { status: string } | null) {
  return goal?.status === "paused" || goal?.status === "completed" ? goal.status : "active";
}

/** What resuming a paused goal would do to its plan; read only then. */
async function loadResumePreview({ goalId, paused }: { goalId: string; paused: boolean }) {
  if (!paused) {
    return null;
  }

  const result = await getGoalResumePreview(goalId);
  return result.status === "ready" ? result.preview : null;
}

/** The goal in the switcher, as the goal list has it. */
function findActiveGoal(list: Awaited<ReturnType<typeof listCurrentUserGoals>>) {
  return list?.goals.find((candidate) => candidate.id === list.activeGoalId) ?? null;
}

/**
 * A goal without a plan yet: still in onboarding, its questions are the one way forward; past
 * them, its plan is being built (or its run needs another try), which the Plan follows.
 */
async function JourneyWithoutPlan({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return <PlanNoGoal />;
  }

  // Only this initial display is cached; onboarding answers and the building client's polling
  // still read fresh state. Goal/profile writes invalidate the cached choice of next screen.
  cacheTag(getGoalsCacheTag(session.user.id), getLearningProfileCacheTag(session.user.id));

  const onboarding = await getOnboarding({ goalId });
  const steps = onboarding.status === "ready" ? onboarding.onboarding.steps : [];

  if (steps.some((step) => step !== "plan")) {
    return <JourneySetup goalId={goalId} goalTitle={goalTitle} />;
  }

  return <JourneyBuildingClient goalId={goalId} goalTitle={goalTitle} />;
}

async function JourneyContent() {
  // Independent cached reads start together, so the tab prefetches in one pass. They all read the
  // active goal. The locale comes from the root param: a prefetch warms its caches with `params`
  // still pending, so reads after `await params` would miss the cache.
  const [readAt, result, progress, language, units, syllabus, mindMaps, buddy, locale, goals] =
    await Promise.all([
      getReadAt(),
      getPlanTabView(),
      getProgressView(),
      getLanguageProgressView(),
      getLanguageUnitsView(),
      getSyllabusView(),
      listGoalMindMaps(),
      getLearnerBuddy(),
      lang(),
      listCurrentUserGoals(),
    ]);

  const activeGoal = findActiveGoal(goals);

  // A quick explanation is one answer, not a way to a goal: it has no plan, so the Plan offers to
  // start a goal as it does to a learner without one (Today holds the explanation).
  if (
    result.status === "noGoal" ||
    result.status === "unauthorized" ||
    activeGoal?.kind === "explain"
  ) {
    return <PlanNoGoal />;
  }

  if (result.status !== "ready" || !result.view.plan.ready) {
    return activeGoal ? (
      <JourneyWithoutPlan goalId={activeGoal.id} goalTitle={activeGoal.title} />
    ) : (
      <PlanNoGoal />
    );
  }

  const { goal, plan, weekTime } = result.view;

  const goalStatus = getGoalStatus(activeGoal);

  const [next, resume] = await Promise.all([
    loadStudyNext({ goalId: goal.id, over: plan.end !== null }),
    loadResumePreview({ goalId: goal.id, paused: goalStatus === "paused" }),
  ]);

  const standing = progress.status === "ready" ? progress.progress : null;
  const alphabet = units.status === "ready" ? units.units.alphabet : null;

  return (
    <JourneyClient
      actions={{
        change: changePlanAction.bind(null, goal.id),
        chooseExamOption: chooseExamOptionAction.bind(null, goal.id),
        chooseTools: choosePlanToolsAction.bind(null, goal.id),
        decide: decidePlanChangeAction.bind(null, goal.id),
        preview: previewPlanChangeAction.bind(null, goal.id),
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
      goalStatus={goalStatus}
      hasMindMaps={mindMaps.status === "ready" && mindMaps.mindMaps.chapters.length > 0}
      language={language.status === "ready" ? language.progress : null}
      next={next && { onContinue: continueNextLevelAction.bind(null, goal.id), view: next }}
      plan={plan}
      readAt={readAt}
      resume={resume}
      preparation={
        standing?.preparation
          ? {
              forExam: goal.kind === "exam",
              kind: "preparation",
              lessons: syllabus.status === "ready" ? syllabus.syllabus.lessons : null,
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
      weekTime={weekTime}
    />
  );
}

/**
 * The Plan for the goal in the switcher: where the learner stands, the road of phases to the goal,
 * and the goal's structure. A goal without its plan yet shows its way there instead: never a
 * missing page.
 */
export default function JourneyPage() {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <JourneyContent />
    </Suspense>
  );
}
