import { safeParseStepContent } from "../../steps/contract/step-contract";

export function toSummaryIdeas(summary: unknown): string[] {
  const parsed = safeParseStepContent("summary", summary);
  return parsed.success ? parsed.data.ideas.map((idea) => idea.text) : [];
}
