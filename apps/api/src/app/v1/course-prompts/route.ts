import { errors } from "@/lib/api-errors";
import { withApiErrorBoundary } from "@/lib/api-handler";
import { parseBody } from "@/lib/body-parser";
import { resolveCoursePromptRequestSchema } from "@/lib/openapi/schemas/course-prompts";
import { resolveLanguageCourse } from "@zoonk/core/courses/language";
import { resolveCoursePrompt } from "@zoonk/core/courses/resolve-prompt";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Maps Core's complete topic-routing outcome to a stable public API resource.
 */
function getTopicPromptResponse(result: Awaited<ReturnType<typeof resolveCoursePrompt>>) {
  if (result.kind === "course") {
    return { courseId: result.course.id, kind: result.kind };
  }

  if (result.kind === "generate") {
    return { coursePromptId: result.prompt.id, kind: "generation" as const };
  }

  if (result.kind === "unsupported") {
    return {
      courseFormat: result.prompt.courseFormat,
      intent: result.prompt.intent,
      kind: result.kind,
      title: result.title,
    };
  }

  return { kind: result.kind };
}

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
    const result = await resolveCoursePrompt({
      language: parsed.data.language,
      prompt: parsed.data.prompt,
    });

    if (result.kind === "invalid") {
      return errors.badRequest("Invalid course prompt");
    }

    return NextResponse.json(getTopicPromptResponse(result));
  }

  const result = await resolveLanguageCourse({
    language: parsed.data.language,
    targetLanguage: parsed.data.targetLanguage,
  });

  return NextResponse.json(
    result.kind === "course"
      ? { courseId: result.course.id, kind: result.kind }
      : { coursePromptId: result.coursePrompt.id, kind: result.kind },
  );
}

export const POST = withApiErrorBoundary(createCoursePrompt);
