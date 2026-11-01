import { type FeedbackContentKind } from "@zoonk/db";
import { z } from "zod";
import { webPlusCancellationRequestSchema } from "../subscriptions/web-plus-cancellation-contract";

const MAX_FEEDBACK_MESSAGE_LENGTH = 5000;

const MAX_FEEDBACK_SCREEN_LENGTH = 100;
const MAX_FEEDBACK_URL_LENGTH = 2000;
const MAX_APP_VERSION_LENGTH = 50;

const feedbackContentKinds = {
  answerExplanation: "answerExplanation",
  chapter: "chapter",
  course: "course",
  item: "item",
  lesson: "lesson",
  lessonQuestion: "lessonQuestion",
  mediaAsset: "mediaAsset",
  plan: "plan",
  planChange: "planChange",
  step: "step",
  stepVariant: "stepVariant",
} as const satisfies { [Kind in FeedbackContentKind]: Kind };

const feedbackContentKindSchema = z.enum(feedbackContentKinds);
const feedbackPlatformSchema = z.enum(["android", "ios", "web"]);

const feedbackContextSchema = z.object({
  appVersion: z.string().trim().max(MAX_APP_VERSION_LENGTH).optional(),
  contentId: z.uuid().optional(),
  contentKind: feedbackContentKindSchema.optional(),
  platform: feedbackPlatformSchema.optional(),
  screen: z.string().trim().max(MAX_FEEDBACK_SCREEN_LENGTH).optional(),
  url: z.string().trim().max(MAX_FEEDBACK_URL_LENGTH).optional(),
});

export const feedbackMessageInputSchema = z.object({
  context: feedbackContextSchema.optional(),
  email: z.email(),
  message: z.string().trim().min(1).max(MAX_FEEDBACK_MESSAGE_LENGTH),
});

/**
 * A request to cancel website Plus sent from the cancel page without logging in. Support confirms
 * it with the account's owner and acts in Stripe; a genuine one counts from `receivedAt`. Only core
 * writes it, never a learner's feedback.
 */
export const plusCancellationRequestSchema = z.object({
  choice: webPlusCancellationRequestSchema.shape.choice,
  email: z.string(),
  name: z.string(),
  reason: z.string().nullable(),
  receivedAt: z.iso.datetime(),
  userId: z.uuid().nullable(),
});

export type FeedbackTarget = Required<Pick<FeedbackContext, "contentId" | "contentKind">>;
export type FeedbackContext = z.infer<typeof feedbackContextSchema>;
export type PlusCancellationRequest = z.infer<typeof plusCancellationRequestSchema>;

/** What a message keeps beside the context it was sent with. */
export type StoredFeedbackContext = FeedbackContext & {
  plusCancellation?: PlusCancellationRequest;
  provenance?: Record<string, string | null>;
};
export type FeedbackMessageInput = z.infer<typeof feedbackMessageInputSchema>;
