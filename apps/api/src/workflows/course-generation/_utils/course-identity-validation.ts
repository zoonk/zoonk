import { type Course } from "@zoonk/db";
import { FatalError } from "workflow";
import { type GeneratableCoursePrompt } from "../steps/get-course-prompt-step";

/**
 * Prevents cached, classified, or unique-conflict matches from linking a prompt
 * to a different generation identity. Format is authoritative, while source
 * and target languages are the dependent values that must match it exactly.
 */
export function assertCourseMatchesPromptIdentity({
  course,
  prompt,
}: {
  course: Pick<Course, "format" | "language" | "targetLanguage">;
  prompt: GeneratableCoursePrompt;
}): void {
  const matchesPrompt =
    course.format === prompt.courseFormat &&
    course.language === prompt.language &&
    course.targetLanguage === prompt.targetLanguage;

  if (!matchesPrompt) {
    throw new FatalError("Recovered course does not match the prompt identity");
  }
}
