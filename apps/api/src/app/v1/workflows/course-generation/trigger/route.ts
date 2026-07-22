import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { getRequestUserId } from "@/lib/get-request-user-id";
import { courseGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { getCoursePromptGenerationError } from "@zoonk/core/courses/prompt-generation";
import { prisma } from "@zoonk/db";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, courseGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const [coursePrompt, userId] = await Promise.all([
    prisma.coursePrompt.findUnique({ where: { id: parsed.data.coursePromptId } }),
    getRequestUserId(request.headers),
  ]);

  if (!coursePrompt) {
    return errors.notFound();
  }

  const generationError = getCoursePromptGenerationError(coursePrompt);

  if (generationError) {
    return errors.badRequest(generationError);
  }

  const run = await start(courseGenerationWorkflow, [
    { coursePromptId: parsed.data.coursePromptId, userId },
  ]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
