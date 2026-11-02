"use client";

import { type SkillOutline } from "@zoonk/core/lookahead/skill-outline-contract";
import { createContext, use } from "react";
import { type OutlineLimit } from "../_components/help-limit-notice";

export type TopicOutlineRequestOutcome =
  | { limit: OutlineLimit; status: "refused" }
  | { status: "failed" | "ready" | "unavailable" | "writing" };

/**
 * `request` is a POST from the learner's tap, never a page load; `read` resolves to null when the
 * server couldn't be reached.
 */
export type TopicOutlineActions = {
  read: (skillId: string) => Promise<SkillOutline | null>;
  refresh: () => void;
  request: (skillId: string) => Promise<TopicOutlineRequestOutcome>;
};

const TopicOutlineContext = createContext<TopicOutlineActions | null>(null);

export const TopicOutlineProvider = TopicOutlineContext.Provider;

export function useTopicOutlineActions(): TopicOutlineActions | null {
  return use(TopicOutlineContext);
}
