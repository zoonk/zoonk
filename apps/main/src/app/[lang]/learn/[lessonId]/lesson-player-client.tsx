"use client";

import { LESSON_FEEDBACK_SLOTS } from "@/components/feedback/lesson-feedback-slots";
import { LearningLink } from "@/components/learn/learning-link";
import { type TutorViewer } from "@/components/learn/main-ask-tutor";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { SessionCeremony } from "@/components/learn/session-ceremony";
import { useSignUpHref } from "@/components/learn/use-sign-up-href";
import { useLessonSessionSlots } from "@/components/session/use-lesson-session-slots";
import { redirect, useRouter } from "@/i18n/navigation";
import { useTutorConfig } from "@/lib/learn/tutor-config";
import { useTutorCards } from "@/lib/learn/use-tutor-cards";
import {
  getExampleLine,
  requestAnswerExplanation,
  requestExampleLine,
} from "@/lib/lessons/lesson-help-requests";
import { checkLessonStep } from "@/lib/lessons/lesson-step-check";
import { type LessonOpening } from "@/lib/session/lesson-opening";
import { requestSpokenGrade } from "@/lib/speech/spoken-answer-request";
import { trackEvent } from "@zoonk/core/analytics/client";
import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { type StudyBlockOpening } from "@zoonk/core/sessions/open-block-contract";
import { useAppLocale } from "@zoonk/learn/locale";
import { LessonPlayerProvider, type LessonPlayerProviderProps } from "@zoonk/player/lesson";
import { LessonPlayerShell } from "@zoonk/player/lesson/shell";
import {
  type LessonPlayerAdapters,
  type LessonPlayerRoutes,
  type LessonRunAnswers,
  type PlayableLibraryLesson,
} from "@zoonk/player/lesson/types";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo, useState } from "react";
import { completeLibraryLessonAction, getLessonPicturesAction } from "./lesson-player-actions";
import { startLibraryLesson } from "./start-library-lesson";

type LessonPlayerSlots = NonNullable<LessonPlayerProviderProps["slots"]>;

export type LessonRouting = Pick<LessonPlayerRoutes, "exit" | "exitTo" | "nextLesson">;

const DEFAULT_ROUTING: LessonRouting = { exit: "/", exitTo: null, nextLesson: null };

function createCeremonySlot(buddy: TutorViewer["buddy"]): Pick<LessonPlayerSlots, "ceremony"> {
  return {
    ceremony: (moments, onClose) => (
      <MainLearnProvider>
        <SessionCeremony buddy={buddy} moments={moments} onClose={onClose} />
      </MainLearnProvider>
    ),
  };
}

function createAdapters({
  learnerId,
  lessonId,
  studySessionId,
  opening,
  onOpened,
}: {
  opening: LessonOpening;
  onOpened: (opening: StudyBlockOpening) => void;
  learnerId: string | null;
  lessonId: string;
  studySessionId: string | null;
}): LessonPlayerAdapters {
  const visit = { sessionId: studySessionId };

  return {
    checkStep: checkLessonStep,
    completeLesson: (input) =>
      completeLibraryLessonAction({ ...input, lessonId, timeZone: getLocalTimeZone() }),
    explainAnswer: requestAnswerExplanation,
    getExampleLine,
    getLessonPictures: (stepIds) => getLessonPicturesAction(lessonId, stepIds),
    gradeSpokenAnswer: (input) => requestSpokenGrade({ ...input, studySessionId: visit.sessionId }),
    requestExampleLine,
    startLesson: (input) =>
      startLibraryLesson({
        lessonId,
        onOpened,
        onSession: (id) => {
          visit.sessionId = id;
        },
        opening,
        renderedLearnerId: learnerId ?? undefined,
        runId: input?.runId,
        studySessionId: visit.sessionId,
      }),
  };
}

type LessonPlayerClientProps = {
  challengeTeam?: ChallengeTeam | null;
  endingSlots?: Pick<
    NonNullable<LessonPlayerProviderProps["slots"]>,
    "completion" | "completionActions"
  >;
  firstAnswer: string | null;
  goalId?: string | null;
  learnerId: string | null;
  lesson: PlayableLibraryLesson;
  outline?: boolean;
  resume?: LessonRunAnswers;
  routing?: LessonRouting;
  finishedBlockId?: string | null;
  opening?: LessonOpening;
  soundsEnabled: boolean;
  studySessionId: string | null;
  tutor: TutorViewer;
  tutorSuggestions?: readonly LessonTutorSuggestion[];
};

function LessonPlayerVisit({
  goalId: lessonGoalId = null,
  challengeTeam = null,
  endingSlots,
  firstAnswer,
  learnerId,
  lesson,
  outline = false,
  resume,
  routing = DEFAULT_ROUTING,
  finishedBlockId = null,
  opening = null,
  soundsEnabled,
  studySessionId,
  tutor: tutorViewer,
  tutorSuggestions,
}: LessonPlayerClientProps) {
  const router = useRouter();
  const locale = useAppLocale();

  const [reopenedBlockId, setReopenedBlockId] = useState(finishedBlockId);
  void setReopenedBlockId;

  const adapters = useMemo(
    () =>
      createAdapters({
        learnerId,
        lessonId: lesson.id,
        onOpened: (destination) => {
          if (destination.kind === "session") {
            router.replace(
              destination.blockId
                ? `/session?block=${destination.blockId}`
                : `/session?session=${destination.sessionId}`,
            );
          } else if (destination.kind === "lesson") {
            router.replace(`/learn/${destination.lessonId}?session=${destination.sessionId}`);
          } else if (
            destination.kind === "unwrittenLesson" ||
            destination.kind === "preparingLesson"
          ) {
            router.replace(`/session?block=${destination.blockId}`);
          } else if (destination.kind === "challenge") {
            router.replace(`/challenge/${destination.planItemId}?session=${destination.sessionId}`);
          } else if (destination.kind === "checkpoint" || destination.kind === "mock") {
            router.replace(
              destination.kind === "mock"
                ? `/mock/${destination.blockId}?session=${destination.sessionId}`
                : `/checkpoint/${destination.blockId}?session=${destination.sessionId}`,
            );
          } else if (destination.kind === "essay") {
            router.replace(`/essay/${destination.blockId}`);
          } else {
            router.replace("/today");
          }
        },
        opening,
        studySessionId,
      }),
    [learnerId, lesson.id, opening, router, studySessionId],
  );

  const { buddy, canAsk, goalId } = tutorViewer;
  const cards = useTutorCards(goalId);

  const tutor = useTutorConfig({ buddy, canAsk, cards, suggestions: tutorSuggestions });

  const sessionSlots = useLessonSessionSlots({
    buddy,
    inSession: opening !== null || studySessionId !== null,
  });

  const slots = useMemo(
    () => ({
      ...LESSON_FEEDBACK_SLOTS,
      ...createCeremonySlot(buddy),
      ...sessionSlots,
      ...endingSlots,
    }),
    [buddy, endingSlots, sessionSlots],
  );

  const signUp = useSignUpHref();

  const routes = useMemo(
    () => ({ ...routing, signUp, upgrade: "/subscription" }),
    [routing, signUp],
  );

  if (reopenedBlockId) {
    redirect({ href: `/session?block=${reopenedBlockId}`, locale });
  }

  return (
    <LessonPlayerProvider
      adapters={adapters}
      challengeTeam={challengeTeam}
      firstAnswer={firstAnswer}
      goalId={lessonGoalId}
      lesson={lesson}
      linkComponent={LearningLink}
      onExit={() => router.push(routes.exit)}
      outline={outline}
      resume={resume}
      routes={routes}
      slots={slots}
      soundsEnabled={soundsEnabled}
      track={trackEvent}
      tutor={tutor}
      viewer={{ learnerId }}
    >
      <LessonPlayerShell />
    </LessonPlayerProvider>
  );
}

/**
 * A link or redirect opens the lesson as the server has it now, so a finished lesson starts over;
 * Back and forward keep the screen as it was.
 */
export function LessonPlayerClient(props: LessonPlayerClientProps) {
  const { bfcacheId } = useRouter();
  return <LessonPlayerVisit key={bfcacheId} {...props} />;
}
