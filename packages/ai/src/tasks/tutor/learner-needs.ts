import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { selectPromptVariants } from "../_utils/prompt-variants";

export type LearnerNeeds = { variants: readonly string[]; note: string | null };

export function getLearnerNeedsPrompt({
  needs,
  template,
}: {
  needs?: LearnerNeeds;
  template: string;
}): string {
  if (!needs?.variants.length) {
    return "";
  }

  const variants = Object.fromEntries(
    [...template.matchAll(/\{\{#(?<name>\w+)\}\}/gu)].map((match): [string, boolean] => {
      const name = match.groups?.name ?? "";
      return [name, needs.variants.includes(name)];
    }),
  );

  return selectPromptVariants({ template, variants });
}

export function getLearnerNeedsLines(needs: LearnerNeeds | undefined): string[] {
  return needs?.note
    ? ["<LEARNER_NEEDS>", formatUntrustedInput({ NOTE: needs.note }), "</LEARNER_NEEDS>"]
    : [];
}
