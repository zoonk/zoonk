import { withApiErrorBoundary } from "@/lib/api-handler";
import { feedbackSubmissionSchema } from "@/lib/openapi/schemas/feedback";
import { readBody } from "@/lib/request-input";
import { submitFeedback } from "@zoonk/core/feedback/submit";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Gives native clients a stable JSON endpoint for the same stored and emailed
 * feedback used by the web feedback form.
 */
async function createFeedback(request: NextRequest) {
  const parsed = await readBody(request, feedbackSubmissionSchema);

  await submitFeedback(parsed);

  return NextResponse.json({ message: "Feedback received" });
}

export const POST = withApiErrorBoundary(createFeedback);
