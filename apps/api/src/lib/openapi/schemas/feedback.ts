import {
  contentFeedbackReasonSchema,
  contentVoteBodySchema,
  contentVoteValueSchema,
  feedbackContentKindSchema,
  feedbackMessageInputSchema,
} from "@zoonk/core/feedback/contract";
import { z } from "zod";

export const feedbackSubmissionSchema = feedbackMessageInputSchema.meta({
  description:
    "A feedback or contact message. `context` says where it was written: the screen, page, content, platform and app version.",
  id: "FeedbackSubmission",
});

export const feedbackResponseSchema = z
  .object({ message: z.string().meta({ examples: ["Feedback received"] }) })
  .meta({ id: "FeedbackResponse" });

export const contentVoteRequestSchema = contentVoteBodySchema.meta({
  description:
    "The learner's vote. Reasons explain a downvote (an upvote has none), and `language` is the interface language the content was read in.",
  id: "ContentVoteRequest",
});

export const contentVoteSchema = z
  .object({
    comment: z.string().nullable(),
    contentId: z.uuid(),
    contentKind: feedbackContentKindSchema,
    reasons: z.array(contentFeedbackReasonSchema),
    updatedAt: z.iso.datetime(),
    vote: contentVoteValueSchema,
  })
  .meta({ description: "The signed-in learner's vote on one piece of content", id: "ContentVote" });
