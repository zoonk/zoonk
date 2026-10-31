"use client";

import { createContext, use } from "react";
import { type ContentFeedbackAdapters, type FeedbackFormRequest } from "./feedback-contract";

export type ContentFeedbackContextValue = {
  adapters: ContentFeedbackAdapters;
  openFeedbackForm: (request: FeedbackFormRequest) => void;
  setMenuOpen: (input: { menuId: string; open: boolean }) => void;
};

export const ContentFeedbackContext = createContext<ContentFeedbackContextValue | null>(null);

export function useContentFeedback(): ContentFeedbackContextValue | null {
  return use(ContentFeedbackContext);
}
