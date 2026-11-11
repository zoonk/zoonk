import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type GeneratedItem, type OptionSelect } from "./item-schemas";
import promptTemplate from "./solve-items.prompt.md";

/**
 * A missed wrong key reaches every learner who gets the item, so catching them comes first. On the
 * solve-items eval (11 Nov 2026, each of 13 cases run 10 times), Terra caught all 60 planted wrong
 * keys and dropped 2 of 500 right items, at $2.73 per 1,000 checks and 4.6 s p50, and at low
 * reasoning it caught them all too, faster and cheaper. In 5 runs each, Luna missed 3 of 30 at
 * high and at xhigh reasoning, and Gemini 4 Argon missed the assembly key in every run. Sonnet and
 * Opus at low missed 6 of 30, so Sonnet backs Terra up at high, its default, where it caught all
 * 30. Terra writes most of these items, and its blind solve still caught its own air fryer key.
 */
const defaultModel = "openai/gpt-6.1-terra";
const defaultReasoning: Reasoning = "low";
const fallbackModels = [{ model: "anthropic/claude-sonnet-5.5", reasoning: "high" }] as const;

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
const VERDICTS = ["none", "true", "false", "undecidable"] as const;

type OptionLetter = (typeof OPTION_LETTERS)[number];
type Answer = (OptionLetter | (typeof VERDICTS)[number])[];

export type SolvableItem = Extract<GeneratedItem, { format: "multipleChoice" | "trueFalse" }>;

/** `picks` holds option indexes and is empty when no option is right; `isTrue` is null when the statement can't be judged. */
export type ItemSolution =
  | { format: "multipleChoice"; picks: number[]; work: string }
  | { format: "trueFalse"; isTrue: boolean | null; work: string };

export type SolveItemsParams = {
  items: readonly SolvableItem[];
  select?: OptionSelect;
  /** What every item is about: a passage, a case, a chart's data, a recording's script or a law's articles. */
  stimulus?: string | null;
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the work before the answer it leads to. */
const schema = z.object({
  answers: z.array(
    z.object({
      item: z.number().int(),
      work: z.string(),
      answer: z.array(z.enum([...OPTION_LETTERS, ...VERDICTS])),
    }),
  ),
});
/* oxlint-enable eslint/sort-keys */

function isOptionLetter(value: string): value is OptionLetter {
  return OPTION_LETTERS.some((letter) => letter === value);
}

/** Only what the learner sees: never the difficulty, the key, its reasons or misconceptions. */
function toQuestion({
  index,
  item,
  select,
}: {
  index: number;
  item: SolvableItem;
  select: OptionSelect;
}) {
  const shown = {
    item: index + 1,
    ...(item.context ? { context: item.context } : {}),
    ...(item.visual ? { [item.visual.kind]: item.visual } : {}),
    ...(item.image ? { picture: item.image.prompt } : {}),
  };

  if (item.format === "trueFalse") {
    return { ...shown, statement: item.statement };
  }

  const options = item.options.map(
    (option, optionIndex) => [OPTION_LETTERS[optionIndex] ?? "", option.text] as const,
  );

  // oxlint-disable-next-line eslint/sort-keys -- The model reads the question before its options.
  return { ...shown, question: item.question, pick: select, options: Object.fromEntries(options) };
}

function toSolution({
  answer,
  item,
  work,
}: {
  answer: Answer;
  item: SolvableItem;
  work: string;
}): ItemSolution {
  if (item.format === "trueFalse") {
    const [verdict] = answer;
    const judged = answer.length === 1 && (verdict === "true" || verdict === "false");
    return { format: "trueFalse", isTrue: judged ? verdict === "true" : null, work };
  }

  const letters = answer.filter((value) => isOptionLetter(value));

  const picks =
    letters.length === answer.length
      ? [...new Set(letters.map((letter) => OPTION_LETTERS.indexOf(letter)))]
      : [];

  return { format: "multipleChoice", picks, work };
}

/** Solves the items without their keys. Each solution is in its item's place, and null when the model skipped it. */
export async function solveItems(params: SolveItemsParams) {
  const {
    analytics,
    items,
    model = defaultModel,
    reasoning = defaultReasoning,
    select = 1,
    serviceTier,
    stimulus,
    useFallback = true,
  } = params;

  const multipleChoice = items.some((item) => item.format === "multipleChoice");
  const trueFalse = items.some((item) => item.format === "trueFalse");

  const systemPrompt = selectPromptVariants({
    template: promptTemplate,
    variants: {
      both: multipleChoice && trueFalse,
      multipleChoice,
      source: Boolean(stimulus),
      trueFalse,
    },
  });

  const questions = items.map((item, index) => toQuestion({ index, item, select }));

  const userPrompt = formatUntrustedInput({
    ...(stimulus ? { SOURCE: stimulus } : {}),
    QUESTIONS: JSON.stringify(questions, null, 1),
  });

  const providerOptions = buildProviderOptions({
    fallbackModels,
    model,
    reasoning,
    serviceTier,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "solve-items",
  });

  const solutions = items.map((item, index) => {
    const solved = result.output.answers.find((entry) => entry.item === index + 1);
    return solved ? toSolution({ answer: solved.answer, item, work: solved.work }) : null;
  });

  return { data: { solutions }, provenance, systemPrompt, usage: result.usage, userPrompt };
}
