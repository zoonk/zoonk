"use client";

import { setGoalStatusAction } from "@/app/[lang]/(learn)/_components/goal-status-action";
import {
  getGenerationIdAction,
  retryGenerationAction,
} from "@/app/[lang]/start/onboarding-actions";
import { getCourseHref } from "@/data/courses/course-href";
import { useRouter } from "@/i18n/navigation";
import { useStartLanguageConversation } from "@/lib/language/use-start-language-conversation";
import { useRefreshWhenOld } from "@/lib/learn/use-refresh-when-old";
import { useWorkflowRun } from "@/lib/workflow/use-workflow-run";
import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import {
  type GoalStatusControl,
  JourneyBuilding,
  type JourneyLinks,
  JourneyScreen,
  type JourneyStanding,
  type PlanTutor,
} from "@zoonk/learn/journey";
import { useSyncExternalStore } from "react";

/**
 * The Journey while the goal's run builds its plan: it follows the run live and reads the plan
 * again once it's saved. "Try again" starts the run again only when the learner taps it.
 */
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
    readGenerationId: () => getGenerationIdAction(goalId),
    restart: () => retryGenerationAction(goalId),
  });

  return <JourneyBuilding goalTitle={goalTitle} onRefresh={() => router.refresh()} run={run} />;
}

type JourneyScreenProps = React.ComponentProps<typeof JourneyScreen>;

/**
 * Where every goal's Journey leads; a language goal's chapters are its units. The mind maps are
 * there once a finished chapter has one or can get one.
 */
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
    mindMaps: hasMindMaps ? "/mind-maps" : null,
    subject: (key) => `/journey/${key}`,
  };
}

/** The buddy's "Choose where to focus" leads to the Journey with this, which opens the sheet. */
const FOCUS_PARAM = "focus";
const CHOOSE_FOCUS = "choose";

/** The address the Journey opened at doesn't change while it's open: nothing to listen to. */
function subscribeToArrival(): () => void {
  return function unsubscribe() {
    // Nothing was listened to, so there's nothing to stop.
  };
}

/** Whether the Journey was opened to choose where to focus; read in the browser, after the shell. */
function useOpenFocus(): boolean {
  return useSyncExternalStore(
    subscribeToArrival,
    () => new URLSearchParams(globalThis.location.search).get(FOCUS_PARAM) === CHOOSE_FOCUS,
    () => false,
  );
}

/** A language goal's level, with its speaking mock opening the call screen. */
function useLanguageStanding(language: LanguageProgressView | null): JourneyStanding | null {
  const startConversation = useStartLanguageConversation();

  if (!language) {
    return null;
  }

  return {
    kind: "language",
    language,
    startSpeakingMock: () => startConversation({ goalId: language.goal.id, kind: "speakingMock" }),
  };
}

type JourneyClientProps = Omit<
  JourneyScreenProps,
  "goalStatus" | "links" | "refresh" | "standing" | "tutor"
> & {
  goalId: string;
  goalStatus: GoalStatusControl["status"];
  /** Whether the goal's mind maps page lists a chapter (`listGoalMindMaps`). */
  hasMindMaps: boolean;
  language: LanguageProgressView | null;
  preparation: Extract<JourneyStanding, { kind: "preparation" }> | null;
  /** When the page read the Journey (`getReadAt`). */
  readAt: number;
};

/**
 * The goal's pause, resume and archive from its "…": a saved change reads the Journey again, and
 * an archived goal leaves it for Today, which moves on to the learner's next goal.
 */
function useGoalStatus({
  goalId,
  status,
}: {
  goalId: string;
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
    status,
  };
}

/**
 * The Journey, read again while lessons in it are still being written, and when it opens from an
 * old prefetched copy. Its "…" leads to the buddy's conversation for questions about the plan, as
 * the plan editor's last row does.
 */
export function JourneyClient({
  buddy,
  goalId,
  goalStatus,
  hasMindMaps,
  language,
  next,
  preparation,
  readAt,
  ...props
}: JourneyClientProps & { buddy: PlanTutor["buddy"] }) {
  const router = useRouter();
  useRefreshWhenOld(readAt);
  const languageStanding = useLanguageStanding(language);
  const status = useGoalStatus({ goalId, status: goalStatus });
  const openFocus = useOpenFocus();

  // The next level replaces the finished goal, so the Journey reads it (its plan building) next.
  const continueNextLevel = async (onContinue: () => Promise<boolean>) => {
    const started = await onContinue();

    if (started) {
      router.refresh();
    }

    return started;
  };

  return (
    <JourneyScreen
      {...props}
      goalStatus={status}
      links={getJourneyLinks({ goalKind: props.goal.kind, hasMindMaps })}
      next={next && { ...next, onContinue: () => continueNextLevel(next.onContinue) }}
      openFocus={openFocus}
      refresh={() => router.refresh()}
      standing={languageStanding ?? preparation}
      tutor={{ buddy, href: "/buddy" }}
    />
  );
}
