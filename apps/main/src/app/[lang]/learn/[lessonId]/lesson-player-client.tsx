"use client";

import { LESSON_FEEDBACK_SLOTS } from "@/components/feedback/lesson-feedback-slots";
import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useLessonSessionSlots } from "@/components/session/use-lesson-session-slots";
import { Link, useRouter } from "@/i18n/navigation";
import { changeLanguageActivityAction } from "@/lib/language/language-activity-action";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { requestExampleLine } from "@/lib/lessons/lesson-help-requests";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { LessonPlayerProvider, type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { LessonPlayerShell } from "@zoonk/player/lesson/shell";
import {
  type LessonPlayerAdapters,
  type LessonPlayerRoutes,
  type LessonRunAnswers,
  type PlayableLibraryLesson,
} from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import {
  checkLessonStepAction,
  completeLibraryLessonAction,
  explainAnswerAction,
  getLessonPicturesAction,
} from "./lesson-player-actions";
import { startLibraryLesson } from "./start-library-lesson";

const ROUTES = { signUp: "/login", upgrade: "/subscription" };

/** Guests and quick explanations play without the questions sheet. */
const NO_TUTOR: TutorViewer = { buddy: null, canAsk: false };

/** Where a lesson closes to: back where it was opened from, and the next lesson there, if any. */
export type LessonRouting = Pick<LessonPlayerRoutes, "exit" | "exitTo" | "nextLesson">;

/** A lesson opened from nowhere in particular (a public page, a quick explanation). */
const DEFAULT_ROUTING: LessonRouting = { exit: "/", exitTo: null, nextLesson: null };

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
    getLessonPictures: () => getLessonPicturesAction(lessonId),
    gradeSpokenAnswer: (input) => requestSpokenGrade({ ...input, studySessionId }),
    startLesson: () => startLibraryLesson({ lessonId, studySessionId }),
  };
}

/**
 * Hosts the lesson player: the app's server actions, its routes and the public API as adapters,
 * its links and its analytics.
 */
export function LessonPlayerClient({
  challengeTeam = null,
  endingSlots,
  firstAnswer,
  hasSession,
  lesson,
  resume,
  routing = DEFAULT_ROUTING,
  sessionContext = null,
  skippableLanguage = null,
  soundsEnabled,
  studySessionId,
  support = null,
  tutor: tutorViewer = NO_TUTOR,
}: {
  /** The learner's colleagues in a challenge, kept with their plan. */
  challengeTeam?: ChallengeTeam | null;
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
  /** The answers of the learner's open run of this lesson, so it opens where they left off. */
  resume?: LessonRunAnswers;
  /**
   * Where closing the lesson goes (back where it was opened from) and the lesson after it in that
   * chapter, which its completion opens next.
   */
  routing?: LessonRouting;
  /** Today's session when the lesson is one of its blocks: its completion moment. */
  sessionContext?: LessonSessionContext | null;
  /** A language lesson of a learner with a plan for the language: "Skip writing" is offered. */
  skippableLanguage?: string | null;
  soundsEnabled: boolean;
  studySessionId: string | null;
  /** How the lesson opens for this learner: new skills explanation first, known ones question first. */
  support?: LessonSupport | null;
  /**
   * Who asks the buddy in the lesson and the buddy who answers (`getTutorViewer`); without it
   * (guests, quick explanations) the lesson plays without questions.
   */
  tutor?: TutorViewer;
}) {
  const router = useRouter();

  const adapters = useMemo(
    () => createAdapters({ lessonId: lesson.id, skippableLanguage, studySessionId }),
    [lesson.id, skippableLanguage, studySessionId],
  );

  const { buddy, canAsk } = tutorViewer;
  const tutor = useMemo(() => getTutorConfig({ buddy, canAsk }), [buddy, canAsk]);
  const sessionSlots = useLessonSessionSlots({ session: sessionContext });

  const slots = useMemo(
    () => ({ ...LESSON_FEEDBACK_SLOTS, ...sessionSlots, ...endingSlots }),
    [endingSlots, sessionSlots],
  );

  const routes = useMemo(() => ({ ...ROUTES, ...routing }), [routing]);

  return (
    <LessonPlayerProvider
      adapters={adapters}
      challengeTeam={challengeTeam}
      firstAnswer={firstAnswer}
      lesson={lesson}
      linkComponent={Link}
      onExit={() => router.push(routes.exit)}
      resume={resume}
      routes={routes}
      slots={slots}
      soundsEnabled={soundsEnabled}
      support={support}
      track={trackEvent}
      tutor={tutor}
      viewer={{ hasSession }}
    >
      <LessonPlayerShell />
    </LessonPlayerProvider>
  );
}
