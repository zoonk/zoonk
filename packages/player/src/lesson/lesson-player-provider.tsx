"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { useEffect, useEffectEvent, useMemo, useReducer } from "react";
import { type PlayerLinkComponent } from "../player-context";
import { UserNameProvider } from "../user-name-context";
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
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "./lesson-player-types";
import { type LessonPlayerSkin } from "./skins/lesson-player-skin";
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
 * A public lesson page lets a visitor answer the first question right there. The player opens
 * with that answer picked, and checks it at once, so the tap counts as the lesson's first step.
 */
function createStartingState({
  firstAnswer,
  lesson,
  support,
}: {
  firstAnswer: string | null;
  lesson: PlayableLibraryLesson;
  support: LessonSupport | null;
}): LessonPlayerState {
  const first = lesson.steps[0];

  if (!firstAnswer || !first || !getOptionIds(first).includes(firstAnswer)) {
    return createInitialState(lesson, support);
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
  /**
   * Explanations open their "Go deeper" version first: the learner's setting, or what memory says
   * they asked for. Off unless the host turns it on.
   */
  deeperByDefault?: boolean;
  /** The option a visitor picked on the lesson's public page, checked as soon as the player opens. */
  firstAnswer?: string | null;
  lesson: PlayableLibraryLesson;
  linkComponent: PlayerLinkComponent;
  /** Called by Escape and by Enter on the completion moment. */
  onExit: () => void;
  routes: LessonPlayerRoutes;
  skin: LessonPlayerSkin;
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

/**
 * Plays one Library lesson. The host supplies the lesson, how to reach the server (adapters), its
 * links and routes, and the mode's skin; everything else, including the run on the server, lives
 * here. A learner or guest with a session starts the run as the lesson opens; a host that shows a
 * lesson without one starts it on the first answer (the web sends screens only with a session).
 */
export function LessonPlayerProvider({
  adapters,
  challengeTeam = null,
  children,
  deeperByDefault = false,
  firstAnswer = null,
  lesson,
  linkComponent,
  onExit,
  routes,
  skin,
  slots = NO_SLOTS,
  soundsEnabled = false,
  support = null,
  track = noTracking,
  tutor,
  viewer,
}: LessonPlayerProviderProps) {
  const [state, dispatch] = useReducer(
    lessonPlayerReducer,
    { firstAnswer, lesson, support },
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
      deeperByDefault,
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
      skin,
      slots,
      soundsEnabled,
      track,
    }),
    [
      adapters,
      challengeTeam,
      deeperByDefault,
      lesson,
      linkComponent,
      onExit,
      routes,
      skin,
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
          <UserNameProvider initialName={viewer.userName}>{children}</UserNameProvider>
        </LessonTutor>
      </LessonPlayerRuntimeContext>
    </LessonPlayerConfigContext>
  );
}
