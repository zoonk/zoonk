"use client";

import { setGoalStatusAction } from "@/app/[lang]/(app)/(learn)/_components/goal-status-action";
import { retryGenerationAction } from "@/app/[lang]/(app)/(onboarding)/start/onboarding-actions";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { getGoalBasesAdvice } from "@/lib/goals/goal-bases-advice";
import { findGoalTimeToCover } from "@/lib/goals/goal-time-advice";
import { readGoalGenerationId } from "@/lib/goals/read-goal-generation-id";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { useRefreshOnPlanChange } from "@/lib/learn/use-refresh-on-plan-change";
import { useTopicOutlineActions } from "@/lib/topic-outlines/use-topic-outline-actions";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import {
  type GoalStatusControl,
  JourneyBuilding,
  type JourneyLinks,
  JourneyScreen,
  type JourneyStanding,
  type PlanActions,
  type PlanTutor,
} from "@zoonk/learn/journey";
import { TopicOutlineProvider } from "@zoonk/learn/topic-outline";
import { useSyncExternalStore } from "react";

/** "Try again" starts the run only on the learner's tap. */
export function JourneyBuildingClient({
  goalId,
  goalTitle,
}: {
  goalId: string;
  goalTitle: string;
}) {
  const router = useRouter();

  const run = useWorkflowRun({
    generationId: null,
    kind: "curriculum",
    onReady: () => router.refresh(),
    readGenerationId: () => readGoalGenerationId(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return <JourneyBuilding goalTitle={goalTitle} onRefresh={() => router.refresh()} run={run} />;
}

type JourneyScreenProps = React.ComponentProps<typeof JourneyScreen>;

function getJourneyLinks({
  goalKind,
  hasMindMaps,
}: {
  goalKind: JourneyScreenProps["goal"]["kind"];
  hasMindMaps: boolean;
}): JourneyLinks {
  return {
    challenge: (planItemId) => `/challenge/${planItemId}`,
    chapter: (chapterId) =>
      goalKind === "language" ? `/content/units/${chapterId}` : `/content/chapters/${chapterId}`,
    course: getCourseHref,
    exam: goalKind === "exam" ? "/exam" : null,
    focusTest: "/focus-test",
    logbook: "/logbook",
    mindMaps: hasMindMaps ? "/mind-maps" : null,
    subject: (key) => `/plan/${key}`,
  };
}

const FOCUS_PARAM = "focus";
const CHOOSE_FOCUS = "choose";
const STUDY_EVERYTHING = "everything";
const ADJUST_PLAN = "adjust";
const ADJUST_TIME = "time";

/** The address the Plan opened at doesn't change while it's open: nothing to listen to. */
function subscribeToArrival(): () => void {
  return function unsubscribe() {
    // Nothing was listened to, so there's nothing to stop.
  };
}

function useArrivalChoice(): string | null {
  return useSyncExternalStore(
    subscribeToArrival,
    () => new URLSearchParams(globalThis.location.search).get(FOCUS_PARAM),
    () => null,
  );
}

function useLanguageStanding(language: LanguageProgressView | null): JourneyStanding | null {
  const startConversation = useStartLanguageConversation();

  if (!language) {
    return null;
  }

  return {
    kind: "language",
    language,
    speakingHref: "/speaking",
    startSpeakingMock: () => startConversation({ goalId: language.goal.id, kind: "speakingMock" }),
  };
}

type JourneyClientProps = Omit<
  JourneyScreenProps,
  "actions" | "goalStatus" | "links" | "refresh" | "standing" | "tutor"
> & {
  actions: Omit<PlanActions, "adviseOnBases" | "findTimeToCover">;
  goalId: string;
  goalStatus: GoalStatusControl["status"];
  hasMindMaps: boolean;
  language: LanguageProgressView | null;
  preparation: Extract<JourneyStanding, { kind: "preparation" }> | null;
  readAt: number;
  resume: GoalStatusControl["resume"];
};

function useGoalStatus({
  goalId,
  resume,
  status,
}: {
  goalId: string;
  resume: GoalStatusControl["resume"];
  status: GoalStatusControl["status"];
}): GoalStatusControl {
  const router = useRouter();

  return {
    onSetStatus: async (next) => {
      const outcome = await setGoalStatusAction(goalId, next);

      if (outcome === "saved" && next === "archived") {
        router.push("/today");
      } else if (outcome === "saved") {
        router.refresh();
      }

      return outcome;
    },
    resume,
    status,
  };
}

export function JourneyClient({
  actions,
  buddy,
  goalId,
  goalStatus,
  hasMindMaps,
  language,
  next,
  preparation,
  readAt,
  resume,
  ...props
}: JourneyClientProps & { buddy: PlanTutor["buddy"] }) {
  const router = useRouter();
  const refreshOnPlanChange = useRefreshOnPlanChange({ goalId, readAt, watch: "plan" });
  const languageStanding = useLanguageStanding(language);
  const status = useGoalStatus({ goalId, resume, status: goalStatus });
  const arrival = useArrivalChoice();
  const outlineActions = useTopicOutlineActions(goalId);

  const continueNextLevel = async (onContinue: () => Promise<boolean>) => {
    const started = await onContinue();

    if (started) {
      router.refresh();
    }

    return started;
  };

  return (
    <TopicOutlineProvider value={outlineActions}>
      <JourneyScreen
        {...props}
        actions={{
          ...actions,
          adviseOnBases: () => getGoalBasesAdvice(goalId),
          findTimeToCover: () => findGoalTimeToCover({ goalId }),
        }}
        goalStatus={status}
        links={getJourneyLinks({ goalKind: props.goal.kind, hasMindMaps })}
        next={next && { ...next, onContinue: () => continueNextLevel(next.onContinue) }}
        openAdjust={arrival === ADJUST_TIME ? "time" : arrival === ADJUST_PLAN}
        openFocus={arrival === CHOOSE_FOCUS}
        openFullCourse={arrival === STUDY_EVERYTHING}
        refresh={refreshOnPlanChange}
        standing={languageStanding ?? preparation}
        tutor={{ buddy, href: "/buddy" }}
      />
    </TopicOutlineProvider>
  );
}
