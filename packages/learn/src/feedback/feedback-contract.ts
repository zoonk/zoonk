import { type FeedbackContext, type FeedbackMessageInput } from "@zoonk/core/feedback/contract";

export type FeedbackFormContext = Pick<
  FeedbackContext,
  "contentId" | "contentKind" | "reportType" | "screen"
>;

export type FeedbackFormRequest = {
  context: FeedbackFormContext;
  isReport: boolean;
  /**
   * The control that opened the form, to get focus back when it closes: Safari doesn't focus a
   * button it presses, so the form can't tell it from what's focused. A menu item leaves it out,
   * since its menu's trigger gets focus back.
   */
  opener?: HTMLElement;
};

/** `sendMessage` resolves to whether it was saved. */
export type ContentFeedbackAdapters = {
  getViewerEmail: () => Promise<string | null>;
  platform: NonNullable<FeedbackContext["platform"]>;
  sendMessage: (input: FeedbackMessageInput) => Promise<boolean>;
};
