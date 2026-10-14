"use client";

import { useMockScreen } from "./mock-context";
import { isDraftAnswered } from "./use-mock-drafts";

/**
 * How much of the running section is answered, flagged and still blank: its questions, and apart
 * from them its essays (a full mock's written part).
 */
export function useSectionCounts() {
  const { runner } = useMockScreen();
  const questions = runner.view.current?.questions ?? [];
  const isBlank = (itemId: string) => !isDraftAnswered(runner.drafts[itemId]);
  const blank = questions.filter((question) => isBlank(question.itemId));

  return {
    answered: questions.length - blank.length,
    blank: blank.filter((question) => question.format !== "essay").length,
    blankEssays: blank.filter((question) => question.format === "essay").length,
    essays: questions.filter((question) => question.format === "essay").length,
    flagged: questions.filter((question) => runner.drafts[question.itemId]?.flagged).length,
    total: questions.length,
  };
}
