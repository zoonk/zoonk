"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { usePreloadMath } from "@zoonk/learn/rich-text/preload-math";
import { useEffect, useEffectEvent, useMemo, useReducer } from "react";
import { type PlayerLinkComponent } from "../player-context";
import { UserNameProvider } from "../user-name-context";
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

function getOptionIds(step: PlayableLibraryStep): string[] {
  if (step.kind === "check") {
    return step.content.options.map((option) => option.id);
  }

  if (step.kind === "hook" && step.content.variant === "guess") {
    return step.content.options.map((option) => option.id);
  }

  return [];
}

/** The first screen's answer: an option id picked on the public page, or a whole answer. */
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

/**
 * A lesson the learner comes back to opens where they left off (`resume`, the open run's answers
 * read with the page). A public lesson page lets a visitor answer the first question right there:
 * the player opens with that answer picked. A hook reveals its local answer immediately; a
 * graded question waits for Check because grading can start model work.
 */
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

  /** The visitor already answered the first screen, so the lesson keeps its own order. */
  const state = createInitialState(lesson);

  return lessonPlayerReducer(state, { answer, stepId: first.id, type: "selectAnswer" });
}

export type LessonPlayerProviderProps = {
  adapters: LessonPlayerAdapters;
  /**
   * The learner's colleagues in challenges, kept with their plan. Without it, a challenge's
   * colleagues go by role.
   */
  challengeTeam?: ChallengeTeam | null;
  children: React.ReactNode;
  /**
   * The first screen's answer, selected when the player opens: the option a visitor picked on
   * the public page, or a whole answer for the playground. Only a hook reveals without Check.
   */
  firstAnswer?: LessonPlayerAnswer | string | null;
  lesson: PlayableLibraryLesson;
  linkComponent: PlayerLinkComponent;
  /** Called by Escape. */
  onExit: () => void;
  /**
   * The lesson's outline beside its reading screens from `lg`: for a short story read screen by
   * screen, such as a quick explanation, whose aside would otherwise stay empty.
   */
  outline?: boolean;
  /**
   * The answers of the learner's open run of this lesson, read with the page, so a lesson they
   * come back to opens where they left off before the run starts again. Empty for a new run.
   */
  resume?: LessonRunAnswers;
  routes: LessonPlayerRoutes;
  slots?: LessonPlayerSlots;
  /** Plays Appearance's sounds for right answers and finishing. Off unless the host turns it on. */
  soundsEnabled?: boolean;
  /**
   * How the lesson opens for this learner (new skills explanation first, partly known ones question
   * first), read with the page; without it, the lesson plays in its own order.
   */
  support?: LessonSupport | null;
  track?: TrackEvent;
  /** The tutor in the step. Without it, the lesson plays without questions. */
  tutor?: LessonTutorConfig;
  viewer: { hasSession: boolean; userName?: string | null };
};

function noTracking() {
  return null;
}

const NO_SLOTS: LessonPlayerSlots = {};
const NO_ANSWERS: LessonRunAnswers = [];

/**
 * Plays one Library lesson. The host supplies the lesson, how to reach the server (adapters), its
 * links and routes; everything else, including the run on the server, lives here. A learner or
 * guest with a session starts the run as the lesson opens; a host that shows a lesson without one
 * starts it on the first answer (the web sends screens only with a session).
 */
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
    const first = lesson.steps[0];
    const answer = state.answers[first?.id ?? ""];

    // A hook only reveals stored words; real checks can grade text or classify a mistake.
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

  const config = useMemo(
    () => ({
      adapters,
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
            <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
          </LessonPicturesProvider>
        </LessonTutor>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
