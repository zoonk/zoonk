"use client";

import { type LessonTutorSuggestion } from "@zoonk/core/lesson-questions/contract";
import { useExtracted } from "next-intl";
import { type LessonQuestionContext } from "./lesson-question-context";
import { type OfferedSuggestion } from "./lesson-question-state";

/** A lesson's suggestions as chips: their words are the server's, and a tap sends their id. */
function toOffered(suggestions: readonly LessonTutorSuggestion[]): OfferedSuggestion[] {
  return suggestions.map(({ id, label }) => ({ question: label, suggestion: id }));
}

/**
 * The buddy's suggested questions for what the learner is asking about; a few, never a list. In a
 * lesson they are what the old "Simpler" and "Go deeper" buttons did, as questions to the buddy,
 * worded by the server in the lesson's payload so the chip reads what the thread will. The empty
 * thread offers them, and so does the lesson's aside after a wrong answer.
 */
export function useTutorSuggestions({
  answered = false,
  contextKind,
  lessonSuggestions,
}: {
  /** A question outside a lesson whose answer is checked: asked about the answer, not for a hint. */
  answered?: boolean;
  contextKind: LessonQuestionContext["kind"];
  lessonSuggestions: readonly LessonTutorSuggestion[];
}): OfferedSuggestion[] {
  const t = useExtracted();

  switch (contextKind) {
    case "answer":
      return [
        { question: t("Walk me through this answer") },
        ...toOffered(lessonSuggestions.filter(({ id }) => id === "simpler")),
      ];
    case "chapter":
      return [{ question: t("What will I be able to do after this chapter?") }];
    case "lesson":
    case "step":
      return toOffered(lessonSuggestions);
    case "mock":
      return [
        { question: t("What should I practice first?") },
        { question: t("Why did I miss these questions?") },
      ];
    case "plan":
      return [
        { question: t("Why am I studying this today?") },
        { question: t("What comes next?") },
      ];
    case "subject":
      return [
        { question: t("What's left to study here?") },
        { question: t("Does my plan cover all of it?") },
      ];
    case "item":
      return [
        answered
          ? { question: t("Walk me through this answer") }
          : { question: t("What is this question asking?") },
        { question: t("What idea is this question about?") },
      ];
    default:
      return contextKind satisfies never;
  }
}
