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

export type LessonPlayerActions = {
  check: () => void;
  continue: () => void;
  explainFirst: () => void;
  goBack: () => void;
  knowThis: () => void;
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
  onRetry: () => void;
};

/** What a report is about: the screen in view. */
type LessonReportTarget = { contentId: string; contentKind: "step" };

/** Parts the host can replace, such as a session block's completion moment. */
export type LessonPlayerSlots = {
  completion?: (props: LessonCompletionSlotProps) => ReactNode;
  /**
   * What comes next on the completion moment, in place of Continue, such as a guest's "Build my
   * plan" and "Create an account to save".
   */
  completionActions?: (props: LessonCompletionSlotProps) => ReactNode;
  /** "Report a problem" in the screen's menu, a message with the screen attached. */
  reportMenuItem?: (target: LessonReportTarget) => ReactNode;
};

type LessonPlayerConfig = {
  adapters: LessonPlayerAdapters;
  /** Who plays the colleagues in a challenge; without it they go by role. */
  challengeTeam: ChallengeTeam | null;
  lesson: Pick<
    PlayableLibraryLesson,
    "estimatedMinutes" | "id" | "language" | "summaryIdeas" | "title"
  >;
  linkComponent: PlayerLinkComponent;
  onExit: () => void;
  routes: LessonPlayerRoutes;
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
