"use client";

import { createContext, useContext } from "react";
import { type CompletionResult } from "./completion-input-schema";
import {
  type DimensionInventory,
  type PlayerPhase,
  type SelectedAnswer,
  type StepResult,
} from "./player-reducer";
import { type SerializedStep } from "./prepare-activity-data";

export type PlayerLinkProps = {
  "aria-label"?: string;
  children?: React.ReactNode;
  className?: string;
  href: string;
};

export type PlayerLinkComponent = React.ComponentType<PlayerLinkProps>;

export type PlayerContextValue = {
  activityId: string;
  completionResult: CompletionResult | null;
  currentResult: StepResult | undefined;
  currentStep: SerializedStep | undefined;
  currentStepIndex: number;
  dimensions: DimensionInventory;
  hasAnswer: boolean;
  isCompleted: boolean;
  isFirstStep: boolean;
  isGameOver: boolean;
  isIntro: boolean;
  isStaticStep: boolean;
  phase: PlayerPhase;
  progressValue: number;
  results: Record<string, StepResult>;
  selectedAnswer: SelectedAnswer | undefined;
  showActionBar: boolean;
  showHeader: boolean;
  totalSteps: number;

  check: () => void;
  continue: () => void;
  escape: () => void;
  navigateNext: () => void;
  navigatePrev: () => void;
  next: () => void;
  restart: () => void;
  selectAnswer: (stepId: string, answer: SelectedAnswer | null) => void;
  startChallenge: () => void;

  completionFooter?: React.ReactNode;
  lessonHref: string;
  levelHref?: string;
  LinkComponent: PlayerLinkComponent;
  loginHref?: string;
  nextActivityHref: string | null;
};

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer(): PlayerContextValue {
  const context = useContext(PlayerContext);

  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }

  return context;
}

export { PlayerContext };
