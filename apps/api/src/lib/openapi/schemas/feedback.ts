import { feedbackMessageInputSchema } from "@zoonk/core/feedback/contract";
import { z } from "zod";

export const feedbackSubmissionSchema = feedbackMessageInputSchema.meta({
  description:
    "A feedback or contact message with an optional reply email. `context` says where it was written: the screen, page, content, platform and app version. A report about answers that keep failing to save carries `context.reportType: saveFailure`.",
  id: "FeedbackSubmission",
});

export const feedbackResponseSchema = z
  .object({ message: z.string().meta({ examples: ["Feedback received"] }) })
  .meta({ id: "FeedbackResponse" });
