"use client";

import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { createContext, useContext } from "react";
import { type PlayerState } from "./player-reducer";
import { type PlayerScreenModel } from "./player-screen";
import { describePlayerStep } from "./player-step";
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
  lessonHref: PlayerRoute;
  levelHref?: PlayerRoute;
  loginHref?: PlayerRoute;
  nextLessonHref: PlayerRoute | null;
};

type ReviewMilestone = {
  kind: "chapter";
  nextHref: PlayerRoute | null;
  reviewHref: PlayerRoute;
};

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
  description: string;
  kind: LessonKind;
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
 * Intro steps are the generated setup for practice-style lessons.
 * When a lesson has no explicit description, the first intro gives the info
 * popover a concrete premise instead of falling back to broad lesson copy.
 */
function getFirstIntroText(state: PlayerState | null): string | null {
  const descriptor = describePlayerStep(state?.steps[0]);

  if (descriptor?.kind !== "intro") {
    return null;
  }

  return descriptor.content.text;
}

/**
 * Builds the single description string consumed by the header info popover.
 * The order keeps authored lesson goals authoritative, then uses lesson
 * setup data, and only falls back to the broader lesson description when the
 * lesson itself has no useful premise.
 */
function getLessonMetaDescription({
  fallbackDescription,
  lessonDescription,
  state,
}: {
  fallbackDescription: string;
  lessonDescription: string | null;
  state: PlayerState | null;
}) {
  if (lessonDescription) {
    return lessonDescription;
  }

  const introText = getFirstIntroText(state);

  if (introText) {
    return introText;
  }

  return fallbackDescription;
}

export function usePlayerLessonMeta(): PlayerLessonMeta {
  const { fallbackDescription, lessonDescription, ...lessonMeta } = usePlayerConfig().lessonMeta;

  const runtimeContext = useContext(PlayerRuntimeContext);
  const state = runtimeContext?.state ?? null;

  return {
    ...lessonMeta,
    description: getLessonMetaDescription({
      fallbackDescription,
      lessonDescription,
      state,
    }),
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
