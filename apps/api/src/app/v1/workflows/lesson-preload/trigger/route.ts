import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { lessonPreloadTriggerSchema } from "@/lib/openapi/schemas/workflows";
import {
  getAiGenerationLessonForWorkflow,
  getWorkflowLessonAccessError,
} from "@/lib/workflow-generation-access";
import { lessonPreloadWorkflow } from "@/workflows/lesson-preload/lesson-preload-workflow";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, lessonPreloadTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const lesson = await getAiGenerationLessonForWorkflow({ lessonId: parsed.data.lessonId });

  if (!lesson) {
    return errors.notFound();
  }

  const accessError = await getWorkflowLessonAccessError({ headers: request.headers, lesson });

  if (accessError) {
    return accessError;
  }

  const run = await start(lessonPreloadWorkflow, [parsed.data.lessonId]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
