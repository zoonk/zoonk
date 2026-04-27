"use client";

import { type ActivityKind } from "@zoonk/core/steps/contract/content";
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
  nextActivityHref: PlayerRoute | null;
};

type ReviewMilestone = {
  kind: "chapter" | "lesson";
  nextHref: PlayerRoute | null;
  reviewHref: PlayerRoute;
};

type CourseMilestone = {
  kind: "course";
  reviewHref: PlayerRoute;
  secondaryReviewHref: PlayerRoute;
};

export type PlayerMilestone = { kind: "activity" } | ReviewMilestone | CourseMilestone;

export type PlayerRuntimeContextValue = {
  actions: PlayerActions;
  screen: PlayerScreenModel;
  state: PlayerState;
};

type PlayerActivityMeta = {
  chapterTitle: string;
  description: string;
  kind: ActivityKind;
  lessonTitle: string;
  title: string | null;
};

type PlayerActivityMetaInput = Omit<PlayerActivityMeta, "description"> & {
  activityDescription: string | null;
  lessonDescription: string;
};

type PlayerConfigContextValue = {
  activityMeta: PlayerActivityMetaInput;
  escape: () => void;
  milestone: PlayerMilestone;
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
 * Intro steps are the generated setup for practice-style activities.
 * When an activity has no explicit description, the first intro gives the info
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
 * The order keeps authored activity goals authoritative, then uses activity
 * setup data, and only falls back to the broader lesson description when the
 * activity itself has no useful premise.
 */
function getActivityMetaDescription({
  activityDescription,
  lessonDescription,
  state,
}: {
  activityDescription: string | null;
  lessonDescription: string;
  state: PlayerState | null;
}) {
  if (activityDescription) {
    return activityDescription;
  }

  const introText = getFirstIntroText(state);

  if (introText) {
    return introText;
  }

  return lessonDescription;
}

export function usePlayerActivityMeta(): PlayerActivityMeta {
  const { activityDescription, lessonDescription, ...activityMeta } =
    usePlayerConfig().activityMeta;

  const runtimeContext = useContext(PlayerRuntimeContext);
  const state = runtimeContext?.state ?? null;

  return {
    ...activityMeta,
    description: getActivityMetaDescription({
      activityDescription,
      lessonDescription,
      state,
    }),
  };
}

export function usePlayerMilestone(): PlayerMilestone {
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
