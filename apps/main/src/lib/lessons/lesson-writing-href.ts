import { readLessonLimitParam, toLessonLimitParam } from "../session/lesson-limit-param";
import { type LessonWritingAnswer } from "./lesson-writing-request";
import { type LessonRequest } from "./use-lesson-writing";

const LESSON_GENERATION_PARAM = "generation";
const WRITING_PARAM = "writing";

/** Carries the click's answer to its wait; none of these query values can start work. */
export function getLessonWritingHref({
  answer,
  lessonId,
}: {
  answer: LessonWritingAnswer;
  lessonId: string;
}) {
  const href = `/learn/${lessonId}` as const;

  if (answer.status === "writing") {
    return `${href}?${LESSON_GENERATION_PARAM}=${encodeURIComponent(answer.generationId)}` as const;
  }

  if (answer.status === "refused") {
    return `${href}?${WRITING_PARAM}=refused&limit=${toLessonLimitParam(answer.limit)}` as const;
  }

  return answer.status === "ready" ? href : (`${href}?${WRITING_PARAM}=${answer.status}` as const);
}

export function readLessonWritingRequest(
  query: Record<string, string | string[] | undefined>,
): LessonRequest {
  const generationId = query[LESSON_GENERATION_PARAM];

  if (typeof generationId === "string" && generationId.length > 0) {
    return { generationId, status: "writing" };
  }

  const status = query[WRITING_PARAM];
  const limit = readLessonLimitParam(query.limit);

  if (status === "refused" && limit) {
    return { limit, status };
  }

  return status === "failed" || status === "plusRequired" || status === "setAside"
    ? { status }
    : { status: "idle" };
}
