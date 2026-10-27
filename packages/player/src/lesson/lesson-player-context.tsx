"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { type ChallengeTeam } from "@zoonk/core/library/challenges/team";
import { type LearnBuddy } from "@zoonk/learn/buddy-name";
import { type MomentCeremony } from "@zoonk/learn/session/moment-ceremony";
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
  /** "I don't know yet" on a written answer: its sample answer shows, and nothing is graded. */
  dontKnow: (stepId: string) => void;
  explainFirst: () => void;
  goBack: () => void;
  knowThis: () => void;
  /** "Write again": takes back "Can't write now" and puts this lesson's writing back. */
  restoreWriting: () => void;
  retryCompletion: () => void;
  retryStart: () => void;
  selectAnswer: (stepId: string, answer: LessonPlayerAnswer | null) => void;
  /** Skips the rest of this lesson's writing, and of every lesson today, without changing the plan. */
  skipWriting: () => void;
  /** Leaves out screens that can't be played after all, such as a numbered picture that never came. */
  skipSteps: (stepIds: string[]) => void;
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
  /**
   * The full-screen moment for a milestone a lesson played on its own earned (a new belt, new
   * glasses), shown before its completion moment, whichever draws it; a session block's moment
   * opens its own.
   */
  ceremony?: MomentCeremony;
  completion?: (props: LessonCompletionSlotProps) => ReactNode;
  /**
   * The header over the completion moment, in place of the lesson's, such as the day's session
   * over a session block's moment. While it returns null (the lesson isn't saved yet), the
   * lesson's header stays. It puts the lesson's `menu` at its end, which keeps the lesson's
   * summary card one tap away.
   */
  completionHeader?: (props: LessonCompletionSlotProps & { menu: ReactNode }) => ReactNode;
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
  /** The learner's buddy, from the tutor, for what the completion says about its Energy. */
  buddy?: LearnBuddy | null;
  /** Who plays the colleagues in a challenge; without it they go by role. */
  challengeTeam: ChallengeTeam | null;
  /** The lesson's personal examples being written in the background; null until it starts. */
  exampleLinesWriting: Promise<unknown> | null;
  lesson: Pick<
    PlayableLibraryLesson,
    "estimatedMinutes" | "id" | "language" | "summaryIdeas" | "targetLanguage" | "title"
  >;
  linkComponent: PlayerLinkComponent;
  onExit: () => void;
  /** The lesson's outline beside its reading screens from `lg`, for a short story (`outline`). */
  outline: boolean;
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
