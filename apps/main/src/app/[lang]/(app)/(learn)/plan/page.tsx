import { getPathname } from "@/i18n/navigation";
import { skipAlphabetAction } from "@/lib/language/skip-alphabet-action";
import { readGoalParam } from "@/lib/learn/goal-param";
import { hasCompletedLessons } from "@/lib/learn/has-completed-lessons";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "@zoonk/core/cache-tags";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { hasGoalMindMaps } from "@zoonk/core/mind-maps/has-any";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { getSession } from "@zoonk/core/users/session";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { getPlanTabView } from "@zoonk/core/view-models/plan/get";
import { getProgressView } from "@zoonk/core/view-models/progress/get";
import { getSyllabusView } from "@zoonk/core/view-models/syllabus/get";
import { toSyllabusSection } from "@zoonk/learn/syllabus-section-view";
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

/** An exam's course can finish before its plan does: its exam-day mocks come after. */
async function loadGoalMapEnd({
  goal,
  over,
}: {
  goal: { id: string; kind: string };
  over: boolean;
}) {
  if (!over && goal.kind !== "exam") {
    return null;
  }

  const result = await getFieldMapView({ goalId: goal.id });
  return result.status === "ready" ? result.map : null;
}

function getGoalStatus(goal: { status: string } | null) {
  return goal?.status === "paused" || goal?.status === "completed" ? goal.status : "active";
}

async function loadResumePreview({ goalId, paused }: { goalId: string; paused: boolean }) {
  if (!paused) {
    return false;
  }

  const result = await getGoalResumePreview(goalId);
  return result.status === "ready" ? result.preview : false;
}

function findShownGoal({
  goalId,
  list,
}: {
  goalId?: string;
  list: Awaited<ReturnType<typeof listCurrentUserGoals>>;
}) {
  return list?.goals.find((candidate) => candidate.id === (goalId ?? list.activeGoalId)) ?? null;
}

/** Kept with the page's prefetch, so the tab opens on the right screen; goal and profile writes expire it. */
async function loadPlanlessStage(goalId: string): Promise<"building" | "setup" | null> {
  "use cache: private";

  const session = await getSession();

  if (!session) {
    return null;
  }

  cacheTag(getGoalsCacheTag(session.user.id), getLearningProfileCacheTag(session.user.id));

  const onboarding = await getOnboarding({ goalId });
  const steps = onboarding.status === "ready" ? onboarding.onboarding.steps : [];

  return steps.some((step) => step !== "plan") ? "setup" : "building";
}

async function JourneyWithoutPlan({ goalId, goalTitle }: { goalId: string; goalTitle: string }) {
  const stage = await loadPlanlessStage(goalId);

  if (!stage) {
    return <PlanNoGoal />;
  }

  if (stage === "setup") {
    return <JourneySetup goalId={goalId} goalTitle={goalTitle} />;
  }

  return <JourneyBuildingClient goalId={goalId} goalTitle={goalTitle} />;
}

async function JourneyContent({ searchParams }: Pick<PageProps<"/[lang]/plan">, "searchParams">) {
  const goalId = readGoalParam(await searchParams);

  // The locale comes from the root param: a prefetch warms its caches with `params` still pending.
  const [readAt, result, progress, language, units, syllabus, hasMindMaps, buddy, locale, goals] =
    await Promise.all([
      getReadAt(),
      getPlanTabView({ goalId }),
      getProgressView({ goalId }),
      getLanguageProgressView({ goalId }),
      getLanguageUnitsView({ goalId }),
      getSyllabusView({ goalId }),
      hasGoalMindMaps({ goalId }),
      getLearnerBuddy(),
      lang(),
      listCurrentUserGoals(),
    ]);

  const shownGoal = findShownGoal({ goalId, list: goals });

  // A quick explanation has no plan, so the Plan offers to start a goal.
  if (
    result.status === "noGoal" ||
    result.status === "unauthorized" ||
    shownGoal?.kind === "explain"
  ) {
    return <PlanNoGoal />;
  }

  if (result.status !== "ready" || !result.view.plan.ready) {
    return shownGoal ? (
      <JourneyWithoutPlan goalId={shownGoal.id} goalTitle={shownGoal.title} />
    ) : (
      <PlanNoGoal />
    );
  }

  const { goal, plan } = result.view;

  const goalStatus = getGoalStatus(shownGoal);

  const [end, resume, completedLessons] = await Promise.all([
    loadGoalMapEnd({ goal, over: plan.end !== null }),
    loadResumePreview({ goalId: goal.id, paused: goalStatus === "paused" }),
    hasCompletedLessons(goal.id),
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
      certificates={end?.certificates ?? null}
      completedLessons={completedLessons}
      goal={{ kind: goal.kind, title: goal.title }}
      goalId={goal.id}
      goalStatus={goalStatus}
      hasMindMaps={hasMindMaps}
      language={language.status === "ready" ? language.progress : null}
      next={
        end?.next
          ? { onContinue: continueNextLevelAction.bind(null, goal.id), view: end.next }
          : null
      }
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
      syllabus={syllabus.status === "ready" ? toSyllabusSection(syllabus.syllabus) : null}
    />
  );
}

export default function JourneyPage({ searchParams }: PageProps<"/[lang]/plan">) {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <JourneyContent searchParams={searchParams} />
    </Suspense>
  );
}
