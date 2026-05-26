import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { chapterGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import {
  getAiGenerationChapterForWorkflow,
  getWorkflowAuthenticationError,
  getWorkflowSubscriptionAccessError,
  requiresSubscriptionForChapterGeneration,
} from "@/lib/workflow-generation-access";
import { chapterGenerationWorkflow } from "@/workflows/chapter-generation/chapter-generation-workflow";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const authError = await getWorkflowAuthenticationError({ headers: request.headers });

  if (authError) {
    return authError;
  }

  const parsed = await parseBody(request, chapterGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const chapter = await getAiGenerationChapterForWorkflow({ chapterId: parsed.data.chapterId });

  if (!chapter) {
    return errors.notFound();
  }

  const accessError = await getWorkflowSubscriptionAccessError({
    headers: request.headers,
    requiresSubscription: requiresSubscriptionForChapterGeneration(chapter),
  });

  if (accessError) {
    return accessError;
  }

  const run = await start(chapterGenerationWorkflow, [parsed.data.chapterId]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
