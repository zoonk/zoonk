"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { createContext, use } from "react";
import {
  type ContentFeedbackAdapters,
  type ContentFeedbackReason,
  type ContentVoteValue,
  type FeedbackFormRequest,
} from "./feedback-contract";

export type ContentFeedbackContextValue = {
  adapters: ContentFeedbackAdapters;
  chooseVote: (input: { target: ContentVoteTarget; vote: ContentVoteValue }) => void;
  /** Undefined until loaded; null when the learner hasn't voted. */
  getVote: (target: ContentVoteTarget) => ContentVoteValue | null | undefined;
  loadVote: (target: ContentVoteTarget) => void;
  openFeedbackForm: (request: FeedbackFormRequest) => void;
  saveDownvoteDetails: (input: {
    comment: string;
    reasons: ContentFeedbackReason[];
    target: ContentVoteTarget;
  }) => void;
  /** A screen's vote menu opened or closed: while one is open, the screen's keys pause. */
  setMenuOpen: (input: { menuId: string; open: boolean }) => void;
};

export const ContentFeedbackContext = createContext<ContentFeedbackContextValue | null>(null);

/**
 * Votes and messages from any screen. Hosts without `ContentFeedbackProvider` get no feedback
 * controls, since every control reads this first and renders nothing without it.
 */
export function useContentFeedback(): ContentFeedbackContextValue | null {
  return use(ContentFeedbackContext);
}
