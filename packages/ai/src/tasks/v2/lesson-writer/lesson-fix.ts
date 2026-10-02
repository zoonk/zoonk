import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../../provider-options";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import systemPrompt from "./lesson-fix.prompt.md";
import {
  type WrittenLesson,
  type WrittenScreen,
  writtenLessonSchema,
  writtenScreenSchema,
} from "./written-lesson-schema";

/**
 * From the lesson-fix eval (3 lessons with code and reviewer problems, 26 Sep
 * 2026): Sol and Gemini 3.8 Flash fixed every one, Sol at $15 per 1,000 fixes
 * and 7s p50, Gemini at $28 and 9s.
 */
const defaultModel = "openai/gpt-6-sol";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

/* oxlint-disable eslint/sort-keys -- Structured output follows schema property order: the screen number comes before its content. */
const schema = z.object({
  screens: z.array(z.object({ screen: z.number().int(), content: writtenScreenSchema })),
  summary: writtenLessonSchema.shape.summary.nullable(),
});
/* oxlint-enable eslint/sort-keys */

export type FixLessonDraftParams = LessonWritingContext & {
  lesson: WrittenLesson;
  problems: LessonProblem[];
  model?: string;
  /** The gateway tier it answers at (see `ServiceTier`); the standard one when unset. */
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function formatLesson(lesson: WrittenLesson): string {
  const screens = lesson.screens.map((screen, index) => ({ screen: index + 1, ...screen }));
  return JSON.stringify({ screens, summary: lesson.summary }, null, 1);
}

/**
 * Puts the fixed screens in place of the old ones. A fix may fill a planned
 * screen the draft left out, but never adds one the plan doesn't have, and
 * extra screens beyond the plan are dropped.
 */
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
      .map((fix): [number, WrittenScreen] => [fix.screen - 1, fix.content])
      .filter(([index]) => index >= 0 && index < screenCount),
  );

  const screens = Array.from(
    { length: screenCount },
    (_, index) => replacements.get(index) ?? lesson.screens[index],
  ).filter((screen) => screen !== undefined);

  return {
    changedScreens: [...replacements.keys()].toSorted((first, second) => first - second),
    lesson: { screens, summary: fixes.summary ?? lesson.summary },
  };
}

/**
 * The fix pass: rewrites only the screens the lesson checks flagged, keeping
 * the rest untouched, and returns the whole fixed lesson with the indexes of
 * the screens it changed, so callers can re-check the lesson and record which
 * run wrote each screen.
 */
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
        output: Output.object({ schema }),
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
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
