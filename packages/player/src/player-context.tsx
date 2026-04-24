"use client";

import { type ActivityKind } from "@zoonk/core/steps/contract/content";
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
  kind: ActivityKind;
  lessonDescription: string;
  lessonTitle: string;
  title: string | null;
};

type PlayerConfigContextValue = {
  activityMeta: PlayerActivityMeta;
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

export function usePlayerActivityMeta(): PlayerActivityMeta {
  return usePlayerConfig().activityMeta;
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
