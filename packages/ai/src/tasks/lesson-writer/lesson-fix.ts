import "server-only";
import { generateText } from "ai";
import { z } from "zod";
import { schemaInPrompt } from "../../_utils/schema-in-prompt";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { readsNoviceRules } from "../_utils/novice-rules";
import { selectPromptVariants } from "../_utils/prompt-variants";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import fixPrompt from "./lesson-fix.prompt.md";
import { normalizeLessonMap } from "./lesson-map";
import { fitWrittenBounds } from "./written-lesson-bounds";
import {
  type WrittenLesson,
  type WrittenScreen,
  numberedScreenSchema,
  writtenLessonSchema,
} from "./written-lesson-schema";

/**
 * A fix rewrites a few flagged screens, so the cheapest model that fixes them leads: Luna fixed 4
 * of 5 cases and Terra all 5 (30 Oct 2026). Opus keeps another family in the chain; on the one case
 * that could be scored cleanly (3 Nov 2026) it fixed the flagged screen but left a 921-character
 * screen over the 750 limit, a new problem the next check catches.
 */
const defaultModel = "openai/gpt-6-luna";
const fallbackModels = ["openai/gpt-6.1-terra", "anthropic/claude-opus-5.5"] as const;

/**
 * Each fixed screen comes back as `LESSON` shows it, its number among its fields: with the screen
 * nested under `content` instead, Sonnet 5.5 answered flat in 3 of 7 tries (3 Nov 2026).
 */
const schema = z.object({
  screens: z.array(numberedScreenSchema),
  summary: writtenLessonSchema.shape.summary.nullable(),
});

const fixOutput = schemaInPrompt(schema, { repair: fitWrittenBounds });

export type FixLessonDraftParams = LessonWritingContext & {
  lesson: WrittenLesson;
  problems: LessonProblem[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatLesson(lesson: WrittenLesson): string {
  const screens = lesson.screens.map((screen, index) => ({ screen: index + 1, ...screen }));
  return JSON.stringify({ screens, summary: lesson.summary }, null, 1);
}

/** A fix may fill a planned screen the draft left out, but never adds one the plan doesn't have. */
function applyLessonFixes({
  fixes,
  lesson,
  screenCount,
}: {
  fixes: z.infer<typeof schema>;
  lesson: WrittenLesson;
  screenCount: number;
}): { changedScreens: number[]; lesson: WrittenLesson } {
  const replacements = new Map(
    fixes.screens
      .map(({ screen, ...content }): [number, WrittenScreen] => [screen - 1, content])
      .filter(([index]) => index >= 0 && index < screenCount),
  );

  const screens = Array.from(
    { length: screenCount },
    (_, index) => replacements.get(index) ?? lesson.screens[index],
  ).filter((screen) => screen !== undefined);

  return {
    changedScreens: [...replacements.keys()].toSorted((first, second) => first - second),
    lesson: {
      screens,
      summary: fixes.summary ? normalizeLessonMap(fixes.summary) : lesson.summary,
    },
  };
}

/** Returns the indexes of the screens it changed, so callers can record which run wrote each. */
export async function fixLessonDraft(params: FixLessonDraftParams) {
  const {
    analytics,
    lesson,
    model = defaultModel,
    reasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

  const novice = readsNoviceRules(params);

  const rules = selectPromptVariants({
    template: fixPrompt,
    variants: { experienced: !novice, novice, shortAnswers: Boolean(params.shortAnswers) },
  });

  const systemPrompt = `${rules}\n\n${fixOutput.outputRules}`;

  const userPrompt = `${formatLessonPlan(params)}
LESSON:
${formatLesson(lesson)}

PROBLEMS:
${formatLessonProblems(params.problems)}
`;

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions: systemPrompt,
        model,
        output: fixOutput.output,
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt,
    task: "lesson-fix",
  });

  const data = applyLessonFixes({
    fixes: result.output,
    lesson,
    screenCount: params.spec.screens.length,
  });

  return { data, provenance, systemPrompt, usage: result.usage, userPrompt };
}
