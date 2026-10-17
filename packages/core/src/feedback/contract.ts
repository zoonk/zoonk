import { type ContentFeedbackReason, type FeedbackContentKind, type VoteValue } from "@zoonk/db";
import { z } from "zod";

const MAX_FEEDBACK_MESSAGE_LENGTH = 5000;

const MAX_FEEDBACK_COMMENT_LENGTH = 1000;
const MAX_FEEDBACK_SCREEN_LENGTH = 100;
const MAX_FEEDBACK_URL_LENGTH = 2000;
const MAX_APP_VERSION_LENGTH = 50;
const MAX_LANGUAGE_LENGTH = 10;

/** Mapped types keep each list in step with its database enum without importing the Prisma runtime. */
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

const contentVoteValues = { down: "down", up: "up" } as const satisfies {
  [Vote in VoteValue]: Vote;
};

const contentFeedbackReasons = {
  hardToFollow: "hardToFollow",
  notWhatINeeded: "notWhatINeeded",
  somethingElse: "somethingElse",
  tooEasy: "tooEasy",
  tooHard: "tooHard",
  wrongOrOutdated: "wrongOrOutdated",
} as const satisfies { [Reason in ContentFeedbackReason]: Reason };

export const feedbackContentKindSchema = z.enum(feedbackContentKinds);
export const contentVoteValueSchema = z.enum(contentVoteValues);
export const contentFeedbackReasonSchema = z.enum(contentFeedbackReasons);
const feedbackPlatformSchema = z.enum(["android", "ios", "web"]);

/** The piece of AI content a vote is about. */
export const contentVoteTargetSchema = z
  .object({ contentId: z.uuid(), contentKind: feedbackContentKindSchema })
  .strict();

const contentVoteBodyShape = {
  comment: z.string().trim().max(MAX_FEEDBACK_COMMENT_LENGTH).nullish(),
  language: z.string().trim().min(2).max(MAX_LANGUAGE_LENGTH).nullish(),
  reasons: z
    .array(contentFeedbackReasonSchema)
    .max(Object.keys(contentFeedbackReasons).length)
    .optional(),
  vote: contentVoteValueSchema,
};

/**
 * Reason chips explain a downvote, so an upvote carries none. Voting up again
 * clears the reasons a previous downvote stored.
 */
function hasReasonsOnlyOnDownvote(body: { reasons?: unknown[]; vote: VoteValue }): boolean {
  return body.vote === "down" || !body.reasons?.length;
}

const REASONS_ON_UPVOTE_ISSUE = { message: "Only a downvote can have reasons", path: ["reasons"] };

/** A learner's vote, with the optional reasons and comment of a downvote sheet. */
export const contentVoteBodySchema = z
  .object(contentVoteBodyShape)
  .strict()
  .refine(hasReasonsOnlyOnDownvote, REASONS_ON_UPVOTE_ISSUE);

export const contentVoteInputSchema = z
  .object({ ...contentVoteTargetSchema.shape, ...contentVoteBodyShape })
  .strict()
  .refine(hasReasonsOnlyOnDownvote, REASONS_ON_UPVOTE_ISSUE);

/**
 * Where a feedback message was written: the screen, the page and the content
 * the learner was on, plus the client's platform and app version.
 */
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

export type ContentVoteInput = z.infer<typeof contentVoteInputSchema>;
export type ContentVoteTarget = z.infer<typeof contentVoteTargetSchema>;
export type FeedbackContext = z.infer<typeof feedbackContextSchema>;
export type FeedbackMessageInput = z.infer<typeof feedbackMessageInputSchema>;
