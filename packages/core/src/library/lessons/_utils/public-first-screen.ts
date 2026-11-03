import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

type PublicOption = { id: string; text: string };

/** Every text is the lesson's rich text, as the player draws it. */
export type PublicFirstScreen =
  | {
      context: string | null;
      guess: boolean;
      kind: "choice";
      options: PublicOption[];
      question: string;
    }
  | { kind: "start" }
  | { kind: "text"; text: string };

function toPublicOptions(options: readonly PublicOption[]): PublicOption[] {
  return options.map((option) => ({ id: option.id, text: option.text }));
}

function toHookScreen(content: unknown): PublicFirstScreen {
  const parsed = safeParseStepContent("hook", content);

  if (!parsed.success) {
    return { kind: "start" };
  }

  if (parsed.data.variant === "text") {
    return { kind: "text", text: parsed.data.text };
  }

  return {
    context: null,
    guess: true,
    kind: "choice",
    options: toPublicOptions(parsed.data.options),
    question: parsed.data.question,
  };
}

function toCheckScreen(content: unknown): PublicFirstScreen {
  const parsed = safeParseStepContent("check", content);

  if (!parsed.success) {
    return { kind: "start" };
  }

  return {
    context: parsed.data.context || null,
    guess: false,
    kind: "choice",
    options: toPublicOptions(parsed.data.options),
    question: parsed.data.question,
  };
}

export function toPublicFirstScreen(step: { content: unknown; kind: StepKind }): PublicFirstScreen {
  if (step.kind === "hook") {
    return toHookScreen(step.content);
  }

  if (step.kind === "check") {
    return toCheckScreen(step.content);
  }

  return { kind: "start" };
}
