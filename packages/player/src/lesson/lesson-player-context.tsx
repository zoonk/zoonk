"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { type ReactNode, createContext, use } from "react";
import { type PlayerLinkComponent } from "../player-context";
import { type LessonScreen } from "./lesson-player-screen";
import { type LessonPlayerState } from "./lesson-player-state";
import {
  type LessonPlayerAdapters,
  type LessonPlayerAnswer,
  type LessonPlayerCompletionState,
  type LessonPlayerRoutes,
  type PlayableLibraryLesson,
} from "./lesson-player-types";
import { type LessonPlayerSkin } from "./skins/lesson-player-skin";

export type LessonPlayerActions = {
  check: () => void;
  continue: () => void;
  explainFirst: () => void;
  goBack: () => void;
  knowThis: () => void;
  restart: () => void;
  retryCompletion: () => void;
  retryStart: () => void;
  selectAnswer: (stepId: string, answer: LessonPlayerAnswer | null) => void;
  /** Leaves a language activity out of the plan and skips its screens in this lesson. */
  skipActivity: (activity: "speaking" | "writing") => Promise<void>;
  submitSpokenAnswer: (input: { audio: Blob; durationMs: number; stepId: string }) => void;
};

export type LessonCompletionSlotProps = {
  completion: LessonPlayerCompletionState;
  correctCount: number;
  incorrectCount: number;
  onRestart: () => void;
  onRetry: () => void;
};

/**
 * What a vote or report is about: the screen in view, its image, its "Simpler" or "Go deeper"
 * version, an answer's explanation or the lesson.
 */
type LessonFeedbackTarget = {
  contentId: string;
  contentKind: "answerExplanation" | "lesson" | "mediaAsset" | "step" | "stepVariant";
};

/** What a companion (Fun's buddy) reacts to: the screen in view and first-try answers in a row. */
type LessonCompanionProps = {
  /** The lesson is done: the companion cheers it on the completion moment. */
  isComplete?: boolean;
  position: number;
  /**
   * The verdict on the screen in view, once it was checked. A guess before the explanation
   * (`isGuess`) earns nothing and costs nothing, so a wrong one isn't a mistake to react to.
   */
  result: { isCorrect: boolean; isGuess?: boolean } | null;
  rightInARow: number;
};

/** Parts the host can replace, such as today's session bar and its completion moment. */
export type LessonPlayerSlots = {
  /** Fun's buddy with its short lines, beside the paper panel. */
  companion?: (props: LessonCompanionProps) => ReactNode;
  completion?: (props: LessonCompletionSlotProps) => ReactNode;
  /**
   * What comes next on the completion moment, in place of Continue and Start over, such as a
   * guest's "Build my plan" and "Create an account to save".
   */
  completionActions?: (props: LessonCompletionSlotProps) => ReactNode;
  /** Small thumbs under an answer's explanation. */
  answerFeedback?: (target: LessonFeedbackTarget) => ReactNode;
  /** The quiet thumbs row on the completion moment, about the lesson. */
  completionFeedback?: (target: LessonFeedbackTarget) => ReactNode;
  /** Entries for the screen's menu ("Helpful", "Not helpful", "Report a problem"). */
  screenMenuItems?: (target: LessonFeedbackTarget) => ReactNode;
  sessionBar?: ReactNode;
};

type LessonPlayerConfig = {
  adapters: LessonPlayerAdapters;
  /** Who plays the colleagues in a challenge; without it they go by role. */
  challengeTeam: ChallengeTeam | null;
  /** Explanations open their "Go deeper" version first, for learners who asked for that register. */
  deeperByDefault: boolean;
  lesson: Pick<
    PlayableLibraryLesson,
    "estimatedMinutes" | "id" | "language" | "summaryIdeas" | "title"
  >;
  linkComponent: PlayerLinkComponent;
  onExit: () => void;
  routes: LessonPlayerRoutes;
  skin: LessonPlayerSkin;
  slots: LessonPlayerSlots;
  /** Appearance's sounds for a right answer and for finishing. */
  soundsEnabled: boolean;
  track: TrackEvent;
};

type LessonPlayerRuntime = {
  actions: LessonPlayerActions;
  screen: LessonScreen;
  state: LessonPlayerState;
};

export const LessonPlayerConfigContext = createContext<LessonPlayerConfig | null>(null);
export const LessonPlayerRuntimeContext = createContext<LessonPlayerRuntime | null>(null);

export function useLessonPlayerConfig(): LessonPlayerConfig {
  const config = use(LessonPlayerConfigContext);

  if (!config) {
    throw new Error("Lesson player parts must be used within a LessonPlayerProvider");
  }

  return config;
}

export function useLessonPlayer(): LessonPlayerRuntime {
  const runtime = use(LessonPlayerRuntimeContext);

  if (!runtime) {
    throw new Error("Lesson player parts must be used within a LessonPlayerProvider");
  }

  return runtime;
}
