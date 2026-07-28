import {
  type CoursePromptResolution as CoreCoursePromptResolution,
  resolveCoursePrompt as resolveCoreCoursePrompt,
} from "@zoonk/core/courses/resolve-prompt";
import { type AiCourseHref, getAiCourseHref } from "./course-href";

type WebCoursePromptResolution =
  | Exclude<CoreCoursePromptResolution, { kind: "course" | "exam" | "language" }>
  | { href: AiCourseHref; kind: "course" }
  | { href: "/start/exam" | "/start/speak"; kind: "redirect" };

/**
 * Maps portable course-prompt outcomes to the main app's navigation contract.
 * Core owns classification, reuse, persistence, and concurrency while this
 * delivery adapter is the only layer that knows web route strings.
 */
function getWebCoursePromptResolution(
  result: CoreCoursePromptResolution,
): WebCoursePromptResolution {
  if (result.kind === "course") {
    return { href: getAiCourseHref(result.course), kind: "course" };
  }

  if (result.kind === "language") {
    return { href: "/start/speak", kind: "redirect" };
  }

  if (result.kind === "exam") {
    return { href: "/start/exam", kind: "redirect" };
  }

  return result;
}

/**
 * Resolves a learner prompt through core and translates only its portable
 * outcome into the web navigation representation consumed by the start page.
 */
export async function resolveCoursePrompt({
  language,
  prompt,
}: {
  language: string;
  prompt: string;
}): Promise<WebCoursePromptResolution> {
  const result = await resolveCoreCoursePrompt({ language, prompt });
  return getWebCoursePromptResolution(result);
}
