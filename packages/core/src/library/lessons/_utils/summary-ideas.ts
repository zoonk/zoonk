import { safeParseStepContent } from "../../steps/contract/step-contract";

/** The summary card is stored on the lesson in the summary step's shape: one sentence per idea. */
export function toSummaryIdeas(summary: unknown): string[] {
  const parsed = safeParseStepContent("summary", summary);
  return parsed.success ? parsed.data.ideas.map((idea) => idea.text) : [];
}
