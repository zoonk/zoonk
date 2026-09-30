import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { formatUntrustedInput } from "../../../evaluate/untrusted-input";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { getPromptLanguageName } from "../../_utils/prompt-language";
import { GENERATED_ITEM_SCHEMAS, type GeneratedItem } from "./item-schemas";
import { checkStatuteDrills } from "./statute-drill-checks";
import systemPrompt from "./statute-drills.prompt.md";

/**
 * From the statute-drills eval (CF/88 art. 5 Cebraspe and GDPR art. 33 mix,
 * Sep 2026): Luna scored 9.65 at $1.23 per 1,000 runs, Sol 9.19 at $23 with a
 * wrong key, Gemini 3.5 Flash Lite 8.77 at $3.26, Gemini 3.8 Flash 8.62 and
 * Sonnet 5 8.08 with a wrong key. After the prompt said what makes a statement
 * false, Luna scored 9.42 on those two cases plus an FGV one.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6-sol", "google/gemini-3.5-flash-lite"] as const;

const MIN_COUNT = 1;
const MAX_COUNT = 20;

/** Options in every statute multiple-choice drill, as FGV writes them; callers pass it to the item checks. */
export const STATUTE_DRILL_OPTION_COUNT = 4;

type StatuteDrillFormat = "trueFalse" | "typed" | "multipleChoice";

/**
 * The exam board's format: Cebraspe judges statements right or wrong, FGV
 * asks multiple choice on the literal text, and generic mixes both with
 * fill-in-the-blank passages.
 */
type StatuteDrillStyle = "cebraspe" | "fgv" | "generic";

/** One article (or paragraph, or item) and its official text as published. */
export type StatuteArticle = { reference: string; text: string };

export type StatuteDrillParams = {
  /** The learner's language, for reasons and misconceptions. Drills keep the law's own wording. */
  language: string;
  /** The law being drilled. `url` points to the official text, for the "read the law" link. */
  law: { title: string; shortName: string; url: string | null };
  articles: StatuteArticle[];
  style: StatuteDrillStyle;
  /** Drills wanted, from 1 to 20. */
  count: number;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

/** An item in one of the drill formats, plus the reference of the article it drills. */
export type StatuteDrill = Extract<GeneratedItem, { format: StatuteDrillFormat }> & {
  reference: string;
};

/** The reference comes first so the model picks its article before writing about it. */
const reference = z.string();

const DRILL_SCHEMAS = {
  multipleChoice: z.object({ reference, ...GENERATED_ITEM_SCHEMAS.multipleChoice.shape }),
  trueFalse: z.object({ reference, ...GENERATED_ITEM_SCHEMAS.trueFalse.shape }),
  typed: z.object({ reference, ...GENERATED_ITEM_SCHEMAS.typed.shape }),
};

/** Each style only allows its board's formats, so a Cebraspe set can't come back as multiple choice. */
const STYLE_SCHEMAS = {
  cebraspe: DRILL_SCHEMAS.trueFalse,
  fgv: DRILL_SCHEMAS.multipleChoice,
  generic: z.union([DRILL_SCHEMAS.trueFalse, DRILL_SCHEMAS.typed, DRILL_SCHEMAS.multipleChoice]),
} as const satisfies Record<StatuteDrillStyle, z.ZodType<StatuteDrill>>;

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
 * Turns statute text (lei seca) into drills on its letter, the way exam
 * boards test it: true statements that repeat the text, false ones that
 * change exactly one element, and fill-in-the-blank passages. The statute's
 * text is passed as data. Only drills that pass the statute checks are
 * returned; `dropped` keeps the others with their problems so callers can log
 * them. Callers still run the item checks in `@zoonk/core` before storing.
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

  const userPrompt = buildUserPrompt(params);
  const schema = z.object({ drills: z.array(STYLE_SCHEMAS[style]) });
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
    systemPrompt,
    task: "statute-drills",
  });

  const drills: StatuteDrill[] = result.output.drills;
  const data = checkStatuteDrills({ articles, drills });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
