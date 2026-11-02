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
  dontKnow: (stepId: string) => void;
  explainFirst: () => void;
  goBack: () => void;
  knowThis: () => void;
  restoreWriting: () => void;
  retryCompletion: () => void;
  retryStart: () => void;
  selectAnswer: (stepId: string, answer: LessonPlayerAnswer | null) => void;
  /** Applies to every lesson today without changing the plan. */
  skipWriting: () => void;
  skipSteps: (stepIds: string[]) => void;
  submitSpokenAnswer: (input: { audio: Blob; durationMs: number; stepId: string }) => void;
};

export type LessonCompletionSlotProps = {
  completion: LessonPlayerCompletionState;
  correctCount: number;
  incorrectCount: number;
  onRetry: () => void;
};

type LessonReportTarget = { contentId: string; contentKind: "step" };

export type LessonPlayerSlots = {
  ceremony?: MomentCeremony;
  completion?: (props: LessonCompletionSlotProps) => ReactNode;
  /** Return null to keep the lesson header; render `menu` at the replacement header's end. */
  completionHeader?: (props: LessonCompletionSlotProps & { menu: ReactNode }) => ReactNode;
  completionActions?: (props: LessonCompletionSlotProps) => ReactNode;
  reportMenuItem?: (target: LessonReportTarget) => ReactNode;
};

type LessonPlayerConfig = {
  adapters: LessonPlayerAdapters;
  buddy?: LearnBuddy | null;
  challengeTeam: ChallengeTeam | null;
  exampleLinesWriting: Promise<unknown> | null;
  lesson: Pick<
    PlayableLibraryLesson,
    "estimatedMinutes" | "id" | "language" | "summaryIdeas" | "targetLanguage" | "title"
  >;
  linkComponent: PlayerLinkComponent;
  onExit: () => void;
  outline: boolean;
  routes: LessonPlayerRoutes;
  slots: LessonPlayerSlots;
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
