import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { selectPromptVariants } from "../../_utils/prompt-variants";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "./item-schemas";
import { checkStatuteDrills } from "./statute-drill-checks";
import rulesTemplate from "./statute-drills.prompt.md";

/** Luna scored highest on the statute-drills eval at a twentieth of Sol's cost (Sep 2026). */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6-sol", "google/gemini-3.5-flash-lite"] as const;

const MIN_COUNT = 1;
const MAX_COUNT = 20;

/** As FGV writes them; callers pass it to the item checks. */
export const STATUTE_DRILL_OPTION_COUNT = 4;

type StatuteDrillFormat = "trueFalse" | "typed" | "multipleChoice";

/** Cebraspe judges statements right or wrong, FGV asks multiple choice, and generic mixes both. */
type StatuteDrillStyle = "cebraspe" | "fgv" | "generic";

export type StatuteArticle = { reference: string; text: string };

export type StatuteDrillParams = {
  /** For reasons and misconceptions; drills keep the law's own wording. */
  language: string;
  law: { title: string; shortName: string; url: string | null };
  articles: StatuteArticle[];
  style: StatuteDrillStyle;
  /** For an exam that asks short written answers; otherwise drills are only answered by picking. */
  fillInTheBlank?: boolean;
  /** 1 to 20. */
  count: number;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

export type StatuteDrill = Extract<GeneratedItem, { format: StatuteDrillFormat }> & {
  reference: string;
};

/** The reference comes first so the model picks its article before writing about it. */
const reference = z.string();

/**
 * Without pictures, every style's schema is small enough for each provider's structured output
 * (Gemini rejected the generic style's with them, 9 Oct 2026).
 */
const NO_PICTURES = { image: true, visual: true } as const;

const DRILL_SCHEMAS = {
  multipleChoice: z.object({
    reference,
    ...GENERATED_ITEM_SCHEMAS.multipleChoice.omit(NO_PICTURES).shape,
  }),
  trueFalse: z.object({ reference, ...GENERATED_ITEM_SCHEMAS.trueFalse.omit(NO_PICTURES).shape }),
  typed: z.object({ reference, ...GENERATED_ITEM_SCHEMAS.typed.omit(NO_PICTURES).shape }),
};

/** Each style only allows its board's formats, so a Cebraspe set can't come back as multiple choice. */
const STYLE_SCHEMAS = {
  cebraspe: DRILL_SCHEMAS.trueFalse,
  fgv: DRILL_SCHEMAS.multipleChoice,
  generic: z.union([DRILL_SCHEMAS.trueFalse, DRILL_SCHEMAS.multipleChoice]),
  genericWithBlanks: z.union([
    DRILL_SCHEMAS.trueFalse,
    DRILL_SCHEMAS.typed,
    DRILL_SCHEMAS.multipleChoice,
  ]),
} as const satisfies Record<string, z.ZodType<Omit<StatuteDrill, keyof typeof NO_PICTURES>>>;

function buildUserPrompt({ articles, count, language, law, style }: StatuteDrillParams): string {
  const references = articles
    .map((article, index) => `${index + 1}. ${article.reference}`)
    .join("\n");

  const texts = Object.fromEntries(
    articles.map((article, index) => [`ARTICLE_${index + 1}`, article.text]),
  );

  return `
    LAW: ${law.title} (${law.shortName})
    STYLE: ${style}
    COUNT: ${Math.min(Math.max(count, MIN_COUNT), MAX_COUNT)}
    LANGUAGE: ${getPromptLanguageName({ language })}
    ARTICLES:
${references}

${formatUntrustedInput(texts)}
  `;
}

/**
 * `dropped` keeps the drills that failed the statute checks, with their problems. Callers still run
 * the item checks in `@zoonk/core` before storing.
 */
export async function generateStatuteDrills(params: StatuteDrillParams) {
  const {
    analytics,
    articles,
    model = defaultModel,
    reasoning,
    style,
    useFallback = true,
  } = params;

  const fillInTheBlank = style === "generic" && Boolean(params.fillInTheBlank);

  const systemPrompt = selectPromptVariants({
    template: rulesTemplate,
    variants: { choicesOnly: !fillInTheBlank, fillInTheBlank },
  });

  const userPrompt = buildUserPrompt(params);
  const drillSchema = fillInTheBlank ? STYLE_SCHEMAS.genericWithBlanks : STYLE_SCHEMAS[style];
  const schema = z.object({ drills: z.array(drillSchema) });
  const providerOptions = buildProviderOptions({ fallbackModels, model, useFallback });

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
    task: "statute-drills",
  });

  const drills: StatuteDrill[] = result.output.drills.map((drill) => ({
    ...drill,
    image: null,
    visual: null,
  }));

  const data = checkStatuteDrills({ articles, drills });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
