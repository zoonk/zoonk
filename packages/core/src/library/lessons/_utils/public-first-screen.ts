import { type StepKind } from "@zoonk/db";
import { safeParseStepContent } from "../../steps/contract/step-contract";

type PublicOption = { id: string; text: string };

/**
 * The part of a lesson's first screen that a public page may show. Choice
 * screens keep only the question and the option texts: which option is right,
 * the reason behind each one and the hook's reveal stay in the player, so the
 * lesson can't be read from the page's HTML.
 */
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

const MARKDOWN_EMPHASIS = /(?<marker>\*\*|\*|`)(?<content>\S(?:.*?\S)?)\k<marker>/gu;
const INLINE_MATH = /\$(?<math>[^$]+)\$/gu;

/**
 * Public pages render rich text as plain prose, without the player's math and
 * Markdown renderer, so emphasis markers and math delimiters are removed and
 * their content kept.
 */
function toPlainText(richText: string): string {
  return richText
    .replaceAll(MARKDOWN_EMPHASIS, "$<content>")
    .replaceAll(INLINE_MATH, "$<math>")
    .trim();
}

function toPublicOptions(options: readonly PublicOption[]): PublicOption[] {
  return options.map((option) => ({ id: option.id, text: option.text }));
}

function toHookScreen(content: unknown): PublicFirstScreen {
  const parsed = safeParseStepContent("hook", content);

  if (!parsed.success) {
    return { kind: "start" };
  }

  if (parsed.data.variant === "text") {
    return { kind: "text", text: toPlainText(parsed.data.text) };
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
    context: parsed.data.context ? toPlainText(parsed.data.context) : null,
    guess: false,
    kind: "choice",
    options: toPublicOptions(parsed.data.options),
    question: parsed.data.question,
  };
}

/**
 * Maps a lesson's first screen to what the public lesson page shows. A guess
 * or a question becomes answerable options (any answer opens the player), a
 * text hook is shown as is, and every other screen only gets a start button.
 */
export function toPublicFirstScreen(step: { content: unknown; kind: StepKind }): PublicFirstScreen {
  if (step.kind === "hook") {
    return toHookScreen(step.content);
  }

  if (step.kind === "check") {
    return toCheckScreen(step.content);
  }

  return { kind: "start" };
}
