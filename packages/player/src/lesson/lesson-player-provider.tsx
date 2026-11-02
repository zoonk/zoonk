"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { usePreloadMath } from "@zoonk/learn/rich-text/preload-math";
import { useEffect, useEffectEvent, useMemo, useReducer } from "react";
import { type PlayerLinkComponent } from "../player-context";
import { LessonPicturesProvider } from "./_components/lesson-pictures";
import { resumeLesson } from "./_utils/lesson-resume";
import {
  LessonPlayerConfigContext,
  LessonPlayerRuntimeContext,
  type LessonPlayerSlots,
} from "./lesson-player-context";
import { lessonPlayerReducer } from "./lesson-player-reducer";
import { getLessonScreen } from "./lesson-player-screen";
import { type LessonPlayerState, createInitialState } from "./lesson-player-state";
import {
  type LessonPlayerAdapters,
  type LessonPlayerAnswer,
  type LessonPlayerRoutes,
  type LessonRunAnswers,
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "./lesson-player-types";
import { LessonTutor } from "./tutor/lesson-tutor";
import { type LessonTutorConfig } from "./tutor/lesson-tutor-context";
import { useAbandonTracking } from "./use-abandon-tracking";
import { useExampleLines } from "./use-example-lines";
import { useLessonPlayerActions } from "./use-lesson-player-actions";
import { CANT_WRITE_TODAY, isChosenToday } from "./use-today-choice";

function getOptionIds(step: PlayableLibraryStep): string[] {
  if (step.kind === "check") {
    return step.content.options.map((option) => option.id);
  }

  if (step.kind === "hook" && step.content.variant === "guess") {
    return step.content.options.map((option) => option.id);
  }

  return [];
}

function toFirstAnswer({
  first,
  firstAnswer,
}: {
  first: PlayableLibraryStep;
  firstAnswer: LessonPlayerAnswer | string;
}): LessonPlayerAnswer | null {
  if (typeof firstAnswer !== "string") {
    return firstAnswer;
  }

  if (!getOptionIds(first).includes(firstAnswer)) {
    return null;
  }

  return first.kind === "hook"
    ? { kind: "hook", optionId: firstAnswer }
    : { kind: "check", optionId: firstAnswer };
}

function createStartingState({
  firstAnswer,
  lesson,
  resume,
  support,
}: {
  firstAnswer: LessonPlayerAnswer | string | null;
  lesson: PlayableLibraryLesson;
  resume: LessonRunAnswers;
  support: LessonSupport | null;
}): LessonPlayerState {
  const first = lesson.steps[0];
  const answer = first && firstAnswer ? toFirstAnswer({ first, firstAnswer }) : null;

  if (!first || !answer) {
    return resumeLesson(createInitialState(lesson, support), resume);
  }

  const state = createInitialState(lesson);

  return lessonPlayerReducer(state, { answer, stepId: first.id, type: "selectAnswer" });
}

export type LessonPlayerProviderProps = {
  adapters: LessonPlayerAdapters;
  challengeTeam?: ChallengeTeam | null;
  children: React.ReactNode;
  /** Only a hook reveals `firstAnswer` immediately; graded screens still require Check. */
  firstAnswer?: LessonPlayerAnswer | string | null;
  lesson: PlayableLibraryLesson;
  linkComponent: PlayerLinkComponent;
  onExit: () => void;
  outline?: boolean;
  resume?: LessonRunAnswers;
  routes: LessonPlayerRoutes;
  slots?: LessonPlayerSlots;
  soundsEnabled?: boolean;
  /** Omit `support` to preserve the lesson's authored order. */
  support?: LessonSupport | null;
  track?: TrackEvent;
  tutor?: LessonTutorConfig;
  viewer: { hasSession: boolean };
};

function noTracking() {
  return null;
}

const NO_SLOTS: LessonPlayerSlots = {};
const NO_ANSWERS: LessonRunAnswers = [];

export function LessonPlayerProvider({
  adapters,
  challengeTeam = null,
  children,
  firstAnswer = null,
  lesson,
  linkComponent,
  onExit,
  outline = false,
  resume = NO_ANSWERS,
  routes,
  slots = NO_SLOTS,
  soundsEnabled = false,
  support = null,
  track = noTracking,
  tutor,
  viewer,
}: LessonPlayerProviderProps) {
  const [state, dispatch] = useReducer(
    lessonPlayerReducer,
    { firstAnswer, lesson, resume, support },
    createStartingState,
  );

  const exampleLines = useExampleLines({ adapters, steps: lesson.steps });

  const actions = useLessonPlayerActions({
    adapters,
    dispatch,
    language: lesson.language,
    state,
    track,
    writeExampleLines: exampleLines.write,
  });

  useAbandonTracking({ state, track });
  usePreloadMath(lesson.steps);
  const screen = useMemo(() => getLessonScreen(state), [state]);
  const pictureSteps = useMemo(() => Object.values(state.steps), [state.steps]);

  const onOpen = useEffectEvent(() => {
    if (isChosenToday(CANT_WRITE_TODAY)) {
      dispatch({ opening: true, type: "skipWriting" });
    }

    const first = lesson.steps[0];
    const answer = state.answers[first?.id ?? ""];

    if (first?.kind === "hook" && answer?.kind === "hook" && firstAnswer) {
      actions.check();
      return;
    }

    if (viewer.hasSession) {
      actions.retryStart();
    }
  });

  useEffect(() => {
    onOpen();
  }, []);

  const buddy = tutor?.buddy;

  const config = useMemo(
    () => ({
      adapters,
      buddy,
      challengeTeam,
      exampleLinesWriting: exampleLines.writing,
      lesson: {
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: lesson.language,
        summaryIdeas: lesson.summaryIdeas,
        targetLanguage: lesson.targetLanguage,
        title: lesson.title,
      },
      linkComponent,
      onExit,
      outline,
      routes,
      slots,
      soundsEnabled,
      track,
    }),
    [
      adapters,
      buddy,
      challengeTeam,
      exampleLines.writing,
      lesson,
      linkComponent,
      onExit,
      outline,
      routes,
      slots,
      soundsEnabled,
      track,
    ],
  );

  const runtime = useMemo(() => ({ actions, screen, state }), [actions, screen, state]);

  return (
    <LessonPlayerConfigContext value={config}>
      <LessonPlayerRuntimeContext value={runtime}>
        <LessonTutor tutor={tutor}>
          <LessonPicturesProvider
            getLessonPictures={adapters.getLessonPictures}
            onPicturesLost={actions.skipSteps}
            steps={pictureSteps}
          >
            {children}
          </LessonPicturesProvider>
        </LessonTutor>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
