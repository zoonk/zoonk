import { z } from "zod";

export const feedbackSubmissionSchema = z
  .object({
    email: z.email().meta({ description: "Reply-to email address" }),
    message: z.string().trim().min(1).meta({ description: "Feedback or contact message body" }),
  })
  .meta({ id: "FeedbackSubmission" });

export const feedbackResponseSchema = z
  .object({ message: z.string().meta({ examples: ["Feedback received"] }) })
  .meta({ id: "FeedbackResponse" });
