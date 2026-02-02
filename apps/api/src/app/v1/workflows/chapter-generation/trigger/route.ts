import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { auth } from "@zoonk/core/auth";
import { findActiveSubscription } from "@zoonk/core/auth/subscription";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";

const schema = z.object({
  chapterId: z.number().int().positive(),
});

async function getSubscriptions(request: NextRequest) {
  try {
    return await auth.api.listActiveSubscriptions({
      headers: request.headers,
    });
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, schema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const subscriptions = await getSubscriptions(request);

  if (!findActiveSubscription(subscriptions)) {
    return errors.paymentRequired();
  }

  const run = await start(chapterGenerationWorkflow, [parsed.data.chapterId]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
