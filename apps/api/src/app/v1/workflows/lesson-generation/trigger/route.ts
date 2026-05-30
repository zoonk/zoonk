import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { lessonGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import {
  getAiGenerationLessonForWorkflow,
  getWorkflowLessonAccessError,
} from "@/lib/workflow-generation-access";
import { lessonGenerationWorkflow } from "@/workflows/lesson-generation/lesson-generation-workflow";
import {
  getBlockingLessonGenerationPrerequisite,
  hasLessonGenerationPrerequisites,
} from "@zoonk/core/lessons/generation-prerequisites";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, lessonGenerationTriggerSchema);

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

  const blockingPrerequisite = hasLessonGenerationPrerequisites(lesson.kind)
    ? await getBlockingLessonGenerationPrerequisite(lesson)
    : null;

  if (blockingPrerequisite) {
    return errors.conflict("Create the required lesson first");
  }

  const run = await start(lessonGenerationWorkflow, [parsed.data.lessonId]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
