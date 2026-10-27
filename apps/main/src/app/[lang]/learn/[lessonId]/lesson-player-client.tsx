"use client";

import { LESSON_FEEDBACK_SLOTS } from "@/components/feedback/lesson-feedback-slots";
import { LearningLink } from "@/components/learn/learning-link";
import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useLessonSessionSlots } from "@/components/session/use-lesson-session-slots";
import { redirect, useRouter } from "@/i18n/navigation";
import { getTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import {
  getExampleLine,
  requestAnswerExplanation,
  requestExampleLine,
} from "@/lib/lessons/lesson-help-requests";
import { checkLessonStep } from "@/lib/lessons/lesson-step-check";
import { type LessonSessionContext } from "@/lib/session/lesson-session-context";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
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
import { useLocale } from "next-intl";
import { useMemo, useState } from "react";
import { completeLibraryLessonAction, getLessonPicturesAction } from "./lesson-player-actions";
import { startLibraryLesson } from "./start-library-lesson";

const ROUTES = { signUp: "/login", upgrade: "/subscription" };

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

/** Where a lesson closes to: back where it was opened from, and the next lesson there, if any. */
export type LessonRouting = Pick<LessonPlayerRoutes, "exit" | "exitTo" | "nextLesson">;

/** A lesson opened from nowhere in particular (a public page, a quick explanation). */
const DEFAULT_ROUTING: LessonRouting = { exit: "/", exitTo: null, nextLesson: null };

/**
 * The full-screen moment for a milestone a lesson played on its own earned, with the learner's
 * buddy. The player sits outside the learning tabs, so the ceremony brings main's adapters along.
 */
function createCeremonySlot(buddy: TutorViewer["buddy"]): Pick<LessonPlayerSlots, "ceremony"> {
  return {
    ceremony: (milestone, onClose) => (
      <MainLearnProvider>
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      </MainLearnProvider>
    ),
  };
}

/** A lesson played as a session block sends its session with the start and spoken answers. */
function createAdapters({
  lessonId,
  studySessionId,
}: {
  lessonId: string;
  studySessionId: string | null;
}): LessonPlayerAdapters {
  return {
    checkStep: checkLessonStep,
    completeLesson: (input) =>
      completeLibraryLessonAction({ ...input, lessonId, timeZone: getLocalTimeZone() }),
    explainAnswer: requestAnswerExplanation,
    getExampleLine,
    getLessonPictures: (stepIds) => getLessonPicturesAction(lessonId, stepIds),
    gradeSpokenAnswer: (input) => requestSpokenGrade({ ...input, studySessionId }),
    requestExampleLine,
    startLesson: (input) => startLibraryLesson({ lessonId, runId: input?.runId, studySessionId }),
  };
}

/**
 * Hosts the lesson player: the app's routes, its server actions and the public API as adapters,
 * its links and its analytics.
 */
export function LessonPlayerClient({
  challengeTeam = null,
  endingSlots,
  firstAnswer,
  hasSession,
  lesson,
  outline = false,
  resume,
  routing = DEFAULT_ROUTING,
  sessionContext = null,
  soundsEnabled,
  studySessionId,
  support = null,
  tutor: tutorViewer,
  tutorSuggestions,
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
  /** The lesson's outline beside its reading screens on a wide screen, for a quick explanation. */
  outline?: boolean;
  /** The answers of the learner's open run of this lesson, so it opens where they left off. */
  resume?: LessonRunAnswers;
  /**
   * Where closing the lesson goes (back where it was opened from) and the lesson after it in that
   * chapter, which its completion opens next.
   */
  routing?: LessonRouting;
  /** Today's session when the lesson is one of its blocks: its completion moment. */
  sessionContext?: LessonSessionContext | null;
  soundsEnabled: boolean;
  studySessionId: string | null;
  /** How the lesson opens for this learner: new skills explanation first, known ones question first. */
  support?: LessonSupport | null;
  /**
   * Who asks the buddy in the lesson and the buddy who answers (`getTutorViewer`): a signed-in
   * learner asks, and a guest sees the way to an account that can.
   */
  tutor: TutorViewer;
  /** The tutor's suggestions for the lesson's screens, worded in its language (`wordTutorSuggestions`). */
  tutorSuggestions?: readonly LessonTutorSuggestion[];
}) {
  const router = useRouter();
  const locale = useLocale();

  /** A completion action refreshes props in place; only a newly opened finished lesson redirects. */
  const [reopenedBlockId, setReopenedBlockId] = useState(
    () =>
      sessionContext?.blocks.find(
        (block) =>
          block.kind === "learn" && block.lessonId === lesson.id && block.status === "completed",
      )?.id ?? null,
  );

  void setReopenedBlockId;

  const adapters = useMemo(
    () => createAdapters({ lessonId: lesson.id, studySessionId }),
    [lesson.id, studySessionId],
  );

  const { buddy, canAsk, goalId } = tutorViewer;
  const cards = useTutorCards(goalId);

  const tutor = useMemo(
    () => getTutorConfig({ buddy, canAsk, cards, suggestions: tutorSuggestions }),
    [buddy, canAsk, cards, tutorSuggestions],
  );

  const sessionSlots = useLessonSessionSlots({ buddy, session: sessionContext });

  const slots = useMemo(
    () => ({
      ...LESSON_FEEDBACK_SLOTS,
      ...createCeremonySlot(buddy),
      ...sessionSlots,
      ...endingSlots,
    }),
    [buddy, endingSlots, sessionSlots],
  );

  const routes = useMemo(() => ({ ...ROUTES, ...routing }), [routing]);

  if (reopenedBlockId) {
    redirect({ href: `/session?block=${reopenedBlockId}`, locale });
  }

  return (
    <LessonPlayerProvider
      adapters={adapters}
      challengeTeam={challengeTeam}
      firstAnswer={firstAnswer}
      lesson={lesson}
      linkComponent={LearningLink}
      onExit={() => router.push(routes.exit)}
      outline={outline}
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
