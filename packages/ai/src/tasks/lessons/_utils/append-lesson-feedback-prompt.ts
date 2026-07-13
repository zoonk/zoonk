import feedbackPrompt from "./lesson-feedback.prompt.md";

const feedbackPlaceholder = "{{FEEDBACK}}";

/**
 * Inserts the shared option-feedback contract at the lesson prompt's explicit
 * feedback section. Requiring exactly one placeholder keeps the instructions
 * near the related output fields and prevents a prompt from silently omitting
 * or duplicating the shared contract.
 */
export function insertLessonFeedbackPrompt(basePrompt: string): string {
  const placeholderCount = basePrompt.split(feedbackPlaceholder).length - 1;

  if (placeholderCount !== 1) {
    throw new Error("Lesson feedback prompt must contain exactly one {{FEEDBACK}} placeholder.");
  }

  return basePrompt.replace(feedbackPlaceholder, feedbackPrompt.trim());
}
