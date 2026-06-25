import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { courseGenerationTriggerSchema } from "@/lib/openapi/schemas/workflows";
import { getCourseStartRequestGenerationError } from "@/workflows/course-generation/_utils/course-start-request-validation";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { prisma } from "@zoonk/db";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, courseGenerationTriggerSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const courseStartRequest = await prisma.courseStartRequest.findUnique({
    where: { id: parsed.data.courseStartRequestId },
  });

  if (!courseStartRequest) {
    return errors.notFound();
  }

  const generationError = getCourseStartRequestGenerationError(courseStartRequest);

  if (generationError) {
    return errors.badRequest(generationError);
  }

  const run = await start(courseGenerationWorkflow, [parsed.data.courseStartRequestId]);

  return NextResponse.json({ message: "Workflow started", runId: run.runId });
}
