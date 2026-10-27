"use client";

import { createContext, use } from "react";
import { type ContentFeedbackAdapters, type FeedbackFormRequest } from "./feedback-contract";

export type ContentFeedbackContextValue = {
  adapters: ContentFeedbackAdapters;
  openFeedbackForm: (request: FeedbackFormRequest) => void;
  /** A screen's report menu opened or closed: while one is open, the screen's keys pause. */
  setMenuOpen: (input: { menuId: string; open: boolean }) => void;
};

export const ContentFeedbackContext = createContext<ContentFeedbackContextValue | null>(null);

/**
 * Reports and messages from any screen. Hosts without `ContentFeedbackProvider` get no feedback
 * controls, since every control reads this first and renders nothing without it.
 */
export function useContentFeedback(): ContentFeedbackContextValue | null {
  return use(ContentFeedbackContext);
}
