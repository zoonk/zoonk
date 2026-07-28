import { getCompatibleCourseFormats } from "@zoonk/core/courses/prompt-generation";
import { type Course } from "@zoonk/db";
import { FatalError } from "workflow";
import { type GeneratableCoursePrompt } from "../steps/get-course-prompt-step";

/**
 * Prevents cached, classified, or unique-conflict matches from linking a prompt
 * to a different generation identity. Formats that share the regular course
 * pipeline are compatible, while source and target languages must still match.
 */
export function assertCourseMatchesPromptIdentity({
  course,
  prompt,
}: {
  course: Pick<Course, "format" | "language" | "targetLanguage">;
  prompt: GeneratableCoursePrompt;
}): void {
  const matchesPrompt =
    getCompatibleCourseFormats(prompt.courseFormat).includes(course.format) &&
    course.language === prompt.language &&
    course.targetLanguage === prompt.targetLanguage;

  if (!matchesPrompt) {
    throw new FatalError("Recovered course does not match the prompt identity");
  }
}
