import { withApiErrorBoundary } from "@/lib/api-handler";
import { feedbackSubmissionSchema } from "@/lib/openapi/schemas/feedback";
import { readBody } from "@/lib/request-input";
import { submitFeedback } from "@zoonk/core/feedback/submit";
import { type NextRequest, NextResponse } from "next/server";

async function createFeedback(request: NextRequest) {
  const parsed = await readBody(request, feedbackSubmissionSchema);

  await submitFeedback(parsed);

  return NextResponse.json({ message: "Feedback received" });
}

export const POST = withApiErrorBoundary(createFeedback);
