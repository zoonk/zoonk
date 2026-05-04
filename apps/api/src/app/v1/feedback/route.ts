import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { feedbackSubmissionSchema } from "@/lib/openapi/schemas/feedback";
import { sendFeedbackMessage } from "@zoonk/core/feedback/send";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Gives native clients a stable JSON endpoint for the same support inbox used
 * by the web feedback form.
 */
export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, feedbackSubmissionSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const { error } = await sendFeedbackMessage(parsed.data);

  if (error) {
    return errors.internal("Unable to send feedback");
  }

  return NextResponse.json({ message: "Feedback received" });
}
