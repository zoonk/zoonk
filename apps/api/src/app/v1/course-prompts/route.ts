import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { learningRequestResponse } from "@/lib/learning-discovery-responses";
import { resolveCoursePromptRequestSchema } from "@/lib/openapi/schemas/course-prompts";
import { resolveLanguageCourse } from "@zoonk/core/courses/language";
import { resolveLearningRequest } from "@zoonk/core/courses/learning-request";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Resolves a topic or supported language request into either an existing course,
 * a durable generation prompt, or a non-generatable classification outcome.
 */
async function createCoursePrompt(request: NextRequest) {
  const parsed = await parseBody(request, resolveCoursePromptRequestSchema);

  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  if (parsed.data.kind === "topic") {
    return learningRequestResponse(
      await resolveLearningRequest({ language: parsed.data.language, prompt: parsed.data.prompt }),
    );
  }

  const result = await resolveLanguageCourse({
    language: parsed.data.language,
    targetLanguage: parsed.data.targetLanguage,
  });

  if (result.kind === "unauthorized") {
    return errors.unauthorized();
  }

  return NextResponse.json(
    result.kind === "course"
      ? { courseId: result.course.id, kind: result.kind }
      : { coursePromptId: result.coursePrompt.id, kind: result.kind },
  );
}

export const POST = withApiErrorBoundary(createCoursePrompt);
