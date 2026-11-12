import { getPathname } from "@/i18n/navigation";
import { skipAlphabetAction } from "@/lib/language/skip-alphabet-action";
import { hasCompletedLessons } from "@/lib/learn/has-completed-lessons";
import { getLearnerBuddy } from "@/lib/learn/learner-buddy";
import { getReadAt } from "@/lib/learn/read-at";
import { getGoalsCacheTag, getLearningProfileCacheTag } from "@zoonk/core/cache-tags";
import { listCurrentUserGoals } from "@zoonk/core/goals/list-current-user";
import { hasMindMapsPage } from "@zoonk/core/mind-maps/contract";
import { getGoalResumePreview } from "@zoonk/core/plans/resume-preview";
import { getSession } from "@zoonk/core/users/session";
import { getLanguageProgressView } from "@zoonk/core/view-models/language/progress";
import { getLanguageUnitsView } from "@zoonk/core/view-models/language/units";
import { getFieldMapView } from "@zoonk/core/view-models/map/get";
import { getOnboarding } from "@zoonk/core/view-models/onboarding/get";
import { hasOnboardingQuestions } from "@zoonk/core/view-models/onboarding/steps";
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
  retryGoalRebuildAction,
  setGoalContentCountryAction,
  setGoalCountryAction,
} from "../_components/goal-status-action";
import {
  changePlanAction,
  chooseExamOptionAction,
  choosePlanToolsAction,
  continueNextLevelAction,
  decidePlanChangeAction,
  previewPlanChangeAction,
} from "./journey-actions";
import { JourneyBuildingClient, JourneyClient, JourneySetupClient } from "./journey-client";
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

function findActiveGoal(list: Awaited<ReturnType<typeof listCurrentUserGoals>>) {
  return list?.goals.find((candidate) => candidate.id === list.activeGoalId) ?? null;
}

function getGoalCountry(goal: ReturnType<typeof findActiveGoal>) {
  return goal?.targetLanguage && goal.regionChoices.length > 0
    ? {
        choices: goal.regionChoices,
        language: goal.targetLanguage,
        onSave: setGoalCountryAction.bind(null, goal.id),
        region: goal.targetRegion,
      }
    : null;
}

function getGoalContentCountry(goal: ReturnType<typeof findActiveGoal>) {
  return goal?.contentCountry
    ? {
        ...goal.contentCountry,
        language: goal.language,
        onChange: setGoalContentCountryAction.bind(null, goal.id),
        onRetry: retryGoalRebuildAction.bind(null, goal.id),
        suggested: goal.suggested,
      }
    : null;
}

function getPlanGoal({
  activeGoal,
  goal,
}: {
  activeGoal: ReturnType<typeof findActiveGoal>;
  goal: { displayName: string; kind: "exam" | "explain" | "language" | "learn" };
}) {
  return {
    contentCountry: getGoalContentCountry(activeGoal),
    country: getGoalCountry(activeGoal),
    displayName: goal.displayName,
    examplesCountry: activeGoal?.examplesCountry ?? null,
    kind: goal.kind,
  };
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

  return hasOnboardingQuestions(steps) ? "setup" : "building";
}

async function JourneyWithoutPlan({
  goal,
}: {
  goal: { displayName: string; id: string; status: string };
}) {
  const stage = await loadPlanlessStage(goal.id);

  if (!stage) {
    return <PlanNoGoal />;
  }

  const Planless = stage === "setup" ? JourneySetupClient : JourneyBuildingClient;

  return (
    <Planless goalId={goal.id} goalStatus={getGoalStatus(goal)} goalTitle={goal.displayName} />
  );
}

async function JourneyContent() {
  // The locale comes from the root param: a prefetch warms its caches with `params` still pending.
  const [readAt, result, progress, language, units, syllabus, buddy, locale, goals] =
    await Promise.all([
      getReadAt(),
      getPlanTabView(),
      getProgressView(),
      getLanguageProgressView(),
      getLanguageUnitsView(),
      getSyllabusView(),
      getLearnerBuddy(),
      lang(),
      listCurrentUserGoals(),
    ]);

  const activeGoal = findActiveGoal(goals);

  // A quick explanation has no plan, so the Plan offers to start a goal.
  if (
    result.status === "noGoal" ||
    result.status === "unauthorized" ||
    activeGoal?.kind === "explain"
  ) {
    return <PlanNoGoal />;
  }

  if (result.status !== "ready" || !result.view.plan.ready) {
    return activeGoal ? <JourneyWithoutPlan goal={activeGoal} /> : <PlanNoGoal />;
  }

  const { goal, plan } = result.view;

  const goalStatus = getGoalStatus(activeGoal);

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
      goal={getPlanGoal({ activeGoal, goal })}
      goalId={goal.id}
      goalStatus={goalStatus}
      hasMindMaps={hasMindMapsPage(goal.kind)}
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

export default function JourneyPage() {
  return (
    <Suspense fallback={<PlanSkeleton />}>
      <JourneyContent />
    </Suspense>
  );
}
