"use client";

import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { createContext, useContext } from "react";
import { type PlayerState } from "./player-reducer";
import { type PlayerScreenModel } from "./player-screen";
import { type PlayerActions } from "./use-player-actions";

export type PlayerRoute = string | URL;

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
  scoreHref?: PlayerRoute;
};

export type PlayerLessonProgress = {
  currentLessonNumber: number;
  remainingChaptersInCourse: number;
  remainingLessonsInChapter: number;
  totalLessonsInChapter: number;
};

type ReviewMilestone = { kind: "chapter"; nextHref: PlayerRoute | null; reviewHref: PlayerRoute };

type CourseMilestone = {
  kind: "course";
  reviewHref: PlayerRoute;
  secondaryReviewHref: PlayerRoute;
};

export type PlayerMilestone = ReviewMilestone | CourseMilestone;

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
  escape: () => void;
  milestone: PlayerMilestone | null;
  navigation: PlayerNavigation;
  next: () => void;
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

export function usePlayerMilestone(): PlayerMilestone | null {
  return usePlayerConfig().milestone;
}

export function usePlayerNavigation(): PlayerNavigation {
  return usePlayerConfig().navigation;
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
