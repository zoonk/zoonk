import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { chapterGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import {
  getAiGenerationChapterForWorkflow,
  hasWorkflowSubscriptionAccess,
  requiresSubscriptionForChapterGeneration,
} from "@/lib/workflow-generation-access";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, chapterGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapter = await getAiGenerationChapterForWorkflow({ chapterId: parsed.data.chapterId });

  if (!chapter) {
    return errors.notFound();
  }

  const hasAccess = await hasWorkflowSubscriptionAccess({
    headers: request.headers,
    requiresSubscription: requiresSubscriptionForChapterGeneration(chapter),
  });

  if (!hasAccess) {
    return errors.paymentRequired();
  }

  const run = await start(chapterGenerationWorkflow, [parsed.data.chapterId]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
