import { errors } from "@/lib/api-errors";
import { parseBody } from "@/lib/body-parser";
import { courseGenerationWorkflow } from "@/workflows/course-generation/course-generation-workflow";
import { type NextRequest, NextResponse } from "next/server";
import { start } from "workflow/api";
import { z } from "zod";

const schema = z.object({
  courseSuggestionId: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
  const parsed = await parseBody(request, schema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const run = await start(courseGenerationWorkflow, [parsed.data.courseSuggestionId]);

  return NextResponse.json({
    message: "Workflow started",
    runId: run.runId,
  });
}
