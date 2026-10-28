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

export type LessonRouting = Pick<LessonPlayerRoutes, "exit" | "exitTo" | "nextLesson">;

const DEFAULT_ROUTING: LessonRouting = { exit: "/", exitTo: null, nextLesson: null };

function createCeremonySlot(buddy: TutorViewer["buddy"]): Pick<LessonPlayerSlots, "ceremony"> {
  return {
    ceremony: (milestone, onClose) => (
      <MainLearnProvider>
        <SessionCeremony buddy={buddy} milestone={milestone} onClose={onClose} />
      </MainLearnProvider>
    ),
  };
}

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
  challengeTeam?: ChallengeTeam | null;
  endingSlots?: Pick<
    NonNullable<LessonPlayerProviderProps["slots"]>,
    "completion" | "completionActions"
  >;
  firstAnswer: string | null;
  hasSession: boolean;
  lesson: PlayableLibraryLesson;
  outline?: boolean;
  resume?: LessonRunAnswers;
  routing?: LessonRouting;
  sessionContext?: LessonSessionContext | null;
  soundsEnabled: boolean;
  studySessionId: string | null;
  support?: LessonSupport | null;
  tutor: TutorViewer;
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
