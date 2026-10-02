"use client";

import { LESSON_FEEDBACK_SLOTS } from "@/components/feedback/lesson-feedback-slots";
import { useLessonSessionSlots } from "@/components/session/use-lesson-session-slots";
import { Link, useRouter } from "@/i18n/navigation";
import { changeLanguageActivityAction } from "@/lib/language/language-activity-action";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { requestExampleLine, requestStepVariant } from "@/lib/lessons/lesson-help-requests";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { LessonBuddyCompanion } from "@zoonk/learn/buddy-companion";
import { useExperienceMode } from "@zoonk/learn/mode";
import { type LearnBuddy } from "@zoonk/learn/navigation";
import { LessonPlayerProvider, type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { LessonPlayerShell } from "@zoonk/player/lesson/shell";
import { focusSkin } from "@zoonk/player/lesson/skins/focus";
import { funSkin } from "@zoonk/player/lesson/skins/fun";
import { type LessonPlayerAdapters, type PlayableLibraryLesson } from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useCallback, useMemo } from "react";
import {
  checkLessonStepAction,
  completeLibraryLessonAction,
  explainAnswerAction,
} from "./lesson-player-actions";
import { startLibraryLesson } from "./start-library-lesson";

const ROUTES = { signUp: "/login", upgrade: "/subscription" };

/** A lesson played as a session block sends its session with the start and spoken answers. */
function createAdapters({
  lessonId,
  skippableLanguage,
  studySessionId,
}: {
  lessonId: string;
  /** The language a learner with a plan for it can skip activities of; null otherwise. */
  skippableLanguage: string | null;
  studySessionId: string | null;
}): LessonPlayerAdapters {
  return {
    ...(skippableLanguage
      ? {
          skipLanguageActivity: (activity) =>
            changeLanguageActivityAction({
              activity,
              skip: true,
              targetLanguage: skippableLanguage,
              timeZone: getLocalTimeZone(),
            }),
        }
      : {}),
    checkStep: (input) => checkLessonStepAction({ ...input, timeZone: getLocalTimeZone() }),
    completeLesson: ({ runId }) =>
      completeLibraryLessonAction({ lessonId, runId, timeZone: getLocalTimeZone() }),
    explainAnswer: explainAnswerAction,
    getExampleLine: requestExampleLine,
    gradeSpokenAnswer: (input) => requestSpokenGrade({ ...input, studySessionId }),
    requestVariant: requestStepVariant,
    startLesson: () => startLibraryLesson({ lessonId, studySessionId }),
  };
}

/** Fun's buddy sits beside the paper and reacts to answers; Focus has no buddy. */
function getSlots(buddy: LearnBuddy | null): NonNullable<LessonPlayerProviderProps["slots"]> {
  if (!buddy) {
    return LESSON_FEEDBACK_SLOTS;
  }

  return {
    ...LESSON_FEEDBACK_SLOTS,
    companion: (moment) => <LessonBuddyCompanion {...moment} buddy={buddy} />,
  };
}

/**
 * Hosts the lesson player: the app's server actions, its routes and the public API as adapters,
 * its links, and the skin for the learner's mode. Focus and Fun play the same lesson with the same state.
 */
export function LessonPlayerClient({
  canAskTutor,
  challengeTeam = null,
  deeperByDefault = false,
  endingSlots,
  firstAnswer,
  hasSession,
  lesson,
  buddy,
  sessionContext = null,
  skippableLanguage = null,
  soundsEnabled,
  studySessionId,
  support = null,
}: {
  canAskTutor: boolean;
  /** The learner's colleagues in a challenge, kept with their plan. */
  challengeTeam?: ChallengeTeam | null;
  /** Explanations open their "Go deeper" version first, from the learner's profile. */
  deeperByDefault?: boolean;
  /**
   * How the lesson ends, when the host shows something else: a quick explanation's own ending,
   * or a guest's "Build my plan" and "Create an account to save".
   */
  endingSlots?: Pick<
    NonNullable<LessonPlayerProviderProps["slots"]>,
    "completion" | "completionActions"
  >;
  firstAnswer: string | null;
  hasSession: boolean;
  lesson: PlayableLibraryLesson;
  buddy: LearnBuddy | null;
  /** Today's session when the lesson is one of its blocks: the session bar and its moment. */
  sessionContext?: LessonSessionContext | null;
  /** A language lesson of a learner with a plan for the language: "Skip writing" is offered. */
  skippableLanguage?: string | null;
  soundsEnabled: boolean;
  studySessionId: string | null;
  /** How the lesson opens for this learner: new skills explanation first, known ones question first. */
  support?: LessonSupport | null;
}) {
  const router = useRouter();
  const mode = useExperienceMode();

  const adapters = useMemo(
    () => createAdapters({ lessonId: lesson.id, skippableLanguage, studySessionId }),
    [lesson.id, skippableLanguage, studySessionId],
  );

  const tutor = useMemo(() => getTutorConfig({ canAsk: canAskTutor }), [canAskTutor]);
  const sessionSlots = useLessonSessionSlots({ lessonId: lesson.id, session: sessionContext });

  const slots = useMemo(
    () => ({ ...getSlots(mode === "fun" ? buddy : null), ...sessionSlots, ...endingSlots }),
    [endingSlots, mode, buddy, sessionSlots],
  );

  const exitHref = sessionContext ? "/today" : "/";

  // The player's events carry the mode it's played in, like the learning screens'.
  const track = useCallback<TrackEvent>(
    (event, options) => trackEvent(event, { mode, ...options }),
    [mode],
  );

  return (
    <LessonPlayerProvider
      adapters={adapters}
      challengeTeam={challengeTeam}
      deeperByDefault={deeperByDefault}
      firstAnswer={firstAnswer}
      lesson={lesson}
      linkComponent={Link}
      onExit={() => router.push(exitHref)}
      routes={{ ...ROUTES, exit: exitHref }}
      skin={mode === "fun" ? funSkin : focusSkin}
      slots={slots}
      soundsEnabled={soundsEnabled}
      support={support}
      track={track}
      tutor={tutor}
      viewer={{ hasSession }}
    >
      <LessonPlayerShell />
    </LessonPlayerProvider>
  );
}
