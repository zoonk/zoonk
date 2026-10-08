"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
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
  type LessonPlayerRoutes,
  type LessonRunAnswers,
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "./lesson-player-types";
import { LessonTutor } from "./tutor/lesson-tutor";
import { type LessonTutorConfig } from "./tutor/lesson-tutor-context";
import { useAbandonTracking } from "./use-abandon-tracking";
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

/**
 * A lesson the learner comes back to opens where they left off (`resume`, the open run's answers
 * read with the page). A public lesson page lets a visitor answer the first question right there:
 * the player opens with that answer picked, and checks it at once, so the tap counts as the
 * lesson's first step.
 */
function createStartingState({
  firstAnswer,
  lesson,
  resume,
  support,
}: {
  firstAnswer: string | null;
  lesson: PlayableLibraryLesson;
  resume: LessonRunAnswers;
  support: LessonSupport | null;
}): LessonPlayerState {
  const first = lesson.steps[0];

  if (!firstAnswer || !first || !getOptionIds(first).includes(firstAnswer)) {
    return resumeLesson(createInitialState(lesson, support), resume);
  }

  /** The visitor already answered the first screen, so the lesson keeps its own order. */
  const state = createInitialState(lesson);

  const answer =
    first.kind === "hook"
      ? { kind: "hook" as const, optionId: firstAnswer }
      : { kind: "check" as const, optionId: firstAnswer };

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
  /** The option a visitor picked on the lesson's public page, checked as soon as the player opens. */
  firstAnswer?: string | null;
  lesson: PlayableLibraryLesson;
  linkComponent: PlayerLinkComponent;
  /** Called by Escape. */
  onExit: () => void;
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

  const actions = useLessonPlayerActions({ adapters, dispatch, state, track });
  useAbandonTracking({ state, track });
  const screen = useMemo(() => getLessonScreen(state), [state]);

  const onOpen = useEffectEvent(() => {
    if (state.answers[lesson.steps[0]?.id ?? ""] && firstAnswer) {
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
      lesson: {
        estimatedMinutes: lesson.estimatedMinutes,
        id: lesson.id,
        language: lesson.language,
        summaryIdeas: lesson.summaryIdeas,
        title: lesson.title,
      },
      linkComponent,
      onExit,
      routes,
      slots,
      soundsEnabled,
      track,
    }),
    [adapters, challengeTeam, lesson, linkComponent, onExit, routes, slots, soundsEnabled, track],
  );

  const runtime = useMemo(() => ({ actions, screen, state }), [actions, screen, state]);

  return (
    <LessonPlayerConfigContext value={config}>
      <LessonPlayerRuntimeContext value={runtime}>
        <LessonTutor tutor={tutor}>
          <LessonPicturesProvider
            getLessonPictures={adapters.getLessonPictures}
            steps={lesson.steps}
          >
            <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
          </LessonPicturesProvider>
        </LessonTutor>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
