"use client";

import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { type ReactNode, createContext, useContext } from "react";
import { type PlayerState, type SelectedAnswer, type StepResult } from "./player-reducer";
import { type PlayerScreenModel } from "./player-screen";
import { type PlayerActions } from "./use-player-actions";

export type PlayerRoute = string;

export type PlayerLinkComponentProps = {
  "aria-keyshortcuts"?: string;
  children: ReactNode;
  className?: string;
  href: PlayerRoute;
  prefetch?: boolean;
};

export type PlayerLinkComponent = (props: PlayerLinkComponentProps) => ReactNode;

export type PlayerViewer = {
  completionFooter?: React.ReactNode;
  isAuthenticated: boolean;
  userName?: string | null;
};

export type PlayerNavigation = {
  chapterHref: PlayerRoute;
  courseHref: PlayerRoute;
  energyHref?: PlayerRoute;
  levelHref?: PlayerRoute;
  loginHref?: PlayerRoute;
  nextLessonHref: PlayerRoute | null;
  patternsHref?: PlayerRoute;
};

export type PlayerLessonProgress = {
  currentLessonNumber: number;
  remainingChaptersInCourse: number;
  remainingLessonsInChapter: number;
  totalLessonsInChapter: number;
};

export type PlayerQuestionContext =
  | { kind: "lesson" }
  | { kind: "step"; step: SerializedStep; stepIndex: number }
  | {
      kind: "answer";
      result: StepResult;
      selectedAnswer: SelectedAnswer;
      step: SerializedStep;
      stepIndex: number;
    };

export type PlayerQuestionSupport = {
  interactionState: "active" | "paused";
  onAskQuestion: (context: PlayerQuestionContext) => void;
  onExplainAnswer: ({
    context,
    question,
  }: {
    context: PlayerQuestionContext;
    question: string;
  }) => void;
};

type ChapterMilestone = { chapterHref: PlayerRoute; kind: "chapter"; nextHref: PlayerRoute | null };

type CourseMilestone = { chapterHref: PlayerRoute; courseHref: PlayerRoute; kind: "course" };

export type PlayerMilestone = ChapterMilestone | CourseMilestone;

export type PlayerRuntimeContextValue = {
  actions: PlayerActions;
  screen: PlayerScreenModel;
  state: PlayerState;
};

type PlayerLessonMeta = {
  chapterTitle: string;
  courseTitle: string;
  description: string;
  kind: LessonKind;
  lessonProgress: PlayerLessonProgress;
  lessonTitle: string;
  title: string | null;
};

type PlayerLessonMetaInput = Omit<PlayerLessonMeta, "description"> & {
  fallbackDescription: string;
  lessonDescription: string | null;
};

type PlayerConfigContextValue = {
  lessonMeta: PlayerLessonMetaInput;
  linkComponent: PlayerLinkComponent;
  milestone: PlayerMilestone | null;
  navigation: PlayerNavigation;
  next: () => void;
  questionSupport: PlayerQuestionSupport | null;
  viewer: PlayerViewer;
};

const PlayerConfigContext = createContext<PlayerConfigContextValue | null>(null);
const PlayerRuntimeContext = createContext<PlayerRuntimeContextValue | null>(null);

function usePlayerConfig(): PlayerConfigContextValue {
  const context = useContext(PlayerConfigContext);

  if (!context) {
    throw new Error("usePlayerConfig must be used within a PlayerProvider");
  }

  return context;
}

/**
 * Builds the single description string consumed by the header info popover.
 * Authored lesson goals stay authoritative; broader fallback copy is only used
 * when the lesson itself has no useful premise.
 */
function getLessonMetaDescription({
  fallbackDescription,
  lessonDescription,
}: {
  fallbackDescription: string;
  lessonDescription: string | null;
}) {
  if (lessonDescription) {
    return lessonDescription;
  }

  return fallbackDescription;
}

export function usePlayerLessonMeta(): PlayerLessonMeta {
  const { fallbackDescription, lessonDescription, ...lessonMeta } = usePlayerConfig().lessonMeta;

  return {
    ...lessonMeta,
    description: getLessonMetaDescription({ fallbackDescription, lessonDescription }),
  };
}

/**
 * Lets the consuming app provide its own routing-aware link while the shared
 * player remains independent from any app-specific locale configuration.
 */
export function usePlayerLinkComponent(): PlayerLinkComponent {
  return usePlayerConfig().linkComponent;
}

export function usePlayerMilestone(): PlayerMilestone | null {
  return usePlayerConfig().milestone;
}

export function usePlayerNavigation(): PlayerNavigation {
  return usePlayerConfig().navigation;
}

export function usePlayerQuestionSupport(): PlayerQuestionSupport | null {
  return usePlayerConfig().questionSupport;
}

export function usePlayerInteractionState(): PlayerQuestionSupport["interactionState"] {
  return usePlayerConfig().questionSupport?.interactionState ?? "active";
}

export function usePlayerRuntime(): PlayerRuntimeContextValue {
  const context = useContext(PlayerRuntimeContext);

  if (!context) {
    throw new Error("usePlayerRuntime must be used within a PlayerProvider");
  }

  return context;
}

export function usePlayerViewer(): PlayerViewer {
  return usePlayerConfig().viewer;
}

export { PlayerConfigContext, PlayerRuntimeContext };
