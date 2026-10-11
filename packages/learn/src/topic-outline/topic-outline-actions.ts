"use client";

import { type SkillOutline } from "@zoonk/core/lookahead/skill-outline-contract";
import { createContext, use } from "react";
import { type OutlineLimit } from "../_components/help-limit-notice";

/**
 * How asking for a far topic's lessons went: being written (or already `ready`), refused by the
 * learner's caps, nothing left to write for it (`unavailable`), or `failed` to reach the server.
 */
export type TopicOutlineRequestOutcome =
  | { limit: OutlineLimit; status: "refused" }
  | { status: "failed" | "ready" | "unavailable" | "writing" };

/**
 * What the host does for a far topic: read its lesson plan (null when the server couldn't be
 * reached), ask for it (a POST on the learner's tap, never on a page load), and read the page
 * again once its lessons are in the plan.
 */
export type TopicOutlineActions = {
  read: (skillId: string) => Promise<SkillOutline | null>;
  refresh: () => void;
  request: (skillId: string) => Promise<TopicOutlineRequestOutcome>;
};

const TopicOutlineContext = createContext<TopicOutlineActions | null>(null);

/** Lets a screen's far topics open their lessons; without it, they only say what the plan knows. */
export const TopicOutlineProvider = TopicOutlineContext.Provider;

export function useTopicOutlineActions(): TopicOutlineActions | null {
  return use(TopicOutlineContext);
}
