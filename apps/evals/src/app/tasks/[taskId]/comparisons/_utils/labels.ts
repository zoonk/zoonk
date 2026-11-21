import { type Decision, type Direction } from "@/lib/comparisons/decision-schema";
import { type Reader, type Variant } from "@/lib/comparisons/schemas";
import { DEFAULT_REASONING, getReasoningLabel, parseReasoning } from "@/lib/models";

export type Side = "incumbent" | "challenger";

export const SIDE_LABELS: Record<Side, string> = { challenger: "Challenger", incumbent: "Current" };

export const OUTCOME_LABELS: Record<Decision["outcome"], string> = {
  "insufficient evidence": "Not enough evidence yet",
  "neither qualifies": "Neither qualifies",
  retain: "Keep the current model",
  switch: "Switch to the challenger",
};

export const STATUS_LABELS: Record<Decision["rows"][number]["status"], string> = {
  disqualified: "Ruled out",
  dominated: "Beaten on every measure",
  eligible: "Qualifies",
  trade: "Has trade-offs",
};

export const DIRECTION_LABELS: Record<Direction, string> = {
  challenger: "Challenger",
  incumbent: "Current",
  split: "Split",
  tie: "Tie",
  unresolved: "Unresolved",
};

const FAMILY_LABELS: Record<Reader["family"], string> = {
  anthropic: "Claude",
  google: "Gemini",
  openai: "GPT",
  owner: "You",
};

const FINDING_LABELS: Record<string, string> = {
  "doesn't hold": "Doesn't hold",
  holds: "Holds",
  "holds for both": "Holds for both",
  unsure: "Unsure",
};

export function findingLabel(finding: string): string {
  return FINDING_LABELS[finding] ?? finding;
}

export function familyLabel(family: string): string {
  return FAMILY_LABELS[family] ?? family;
}

export function modelName(model: string): string {
  return model.split("/").at(-1) ?? model;
}

export function variantName(variant: Variant): string {
  const reasoning = parseReasoning(variant.reasoning);
  const name = modelName(variant.model);

  return reasoning && reasoning !== DEFAULT_REASONING
    ? `${name} (${getReasoningLabel(reasoning)})`
    : name;
}

/** The models after the writer, such as a reviewer and a fixer; empty for a writer alone. */
export function laterModels(variant: Variant): { name: string; step: number }[] {
  return variant.pipeline
    .map((model, step) => ({ name: modelName(model), step }))
    .filter(({ step }) => step > 0);
}

const languageNames = new Intl.DisplayNames(["en"], { fallback: "code", type: "language" });

export function languageName(code: string): string {
  return languageNames.of(code) ?? code;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  });
}
