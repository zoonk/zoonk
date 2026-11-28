import "server-only";
import { generateText } from "ai";
import { z } from "zod";
import { schemaInPrompt } from "../../_utils/schema-in-prompt";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { type Reasoning, type ServiceTier, buildProviderOptions } from "../../provider-options";
import { readsNoviceRules } from "../_utils/novice-rules";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { type PublishedLessonScreen } from "../lesson-spec/lesson-activity-plan";
import activityRules from "./activity.prompt.md";
import {
  type LessonProblem,
  type LessonWritingContext,
  formatLessonPlan,
  formatLessonProblems,
} from "./format-lesson-plan";
import formattingRules from "./formatting.prompt.md";
import promptTemplate from "./lesson-activities.prompt.md";
import { FIND_ERROR_TEMPLATE, WRITER_MODELS, getLessonWriterModel } from "./lesson-writer";
import { getScreenCharacterTarget } from "./screen-length";
import voiceRules from "./voice.prompt.md";
import { WRITTEN_SCREEN_SCHEMAS } from "./written-lesson-schema";

const rulesTemplate = promptTemplate
  .replace("{{VOICE}}", () => voiceRules.trimEnd())
  .replace("{{ACTIVITY}}", () => activityRules.trimEnd())
  .replace("{{FORMATTING}}", () => formattingRules.trimEnd());

const schema = z.object({
  screens: z.array(
    z.object({ screen: z.number().int(), ...WRITTEN_SCREEN_SCHEMAS.activity.shape }),
  ),
});

const activitiesOutput = schemaInPrompt(schema);

export type WriteLessonActivitiesParams = LessonWritingContext & {
  screens: readonly PublishedLessonScreen[];
  /** 0-based screens of the plan to write as their activity. */
  indexes: readonly number[];
  problems?: readonly LessonProblem[];
  model?: string;
  serviceTier?: ServiceTier;
  useFallback?: boolean;
  reasoning?: Reasoning;
  analytics?: AiGenerationContext;
};

function buildSystemPrompt(params: WriteLessonActivitiesParams): string {
  const rules = selectPromptVariants({
    template: rulesTemplate,
    variants: {
      novice: readsNoviceRules(params),
      spotAiMistake: params.indexes.some(
        (index) => params.spec.screens[index]?.activityTemplate === FIND_ERROR_TEMPLATE,
      ),
    },
  }).replaceAll("{{SCREEN_CHARACTERS}}", String(getScreenCharacterTarget(params.language)));

  return `${rules}\n\n${activitiesOutput.outputRules}`;
}

function buildUserPrompt(params: WriteLessonActivitiesParams): string {
  const screens = params.screens.map((screen, index) => ({ screen: index + 1, ...screen }));
  const problems = params.problems ?? [];

  const earlier =
    problems.length > 0
      ? `\nEARLIER_TRY:\nAn earlier try at these screens was held back for these problems. Write them without any of them.\n${formatLessonProblems(problems)}\n`
      : "";

  return `${formatLessonPlan(params)}
LESSON:
${JSON.stringify(screens, null, 1)}

SCREENS_TO_WRITE: ${params.indexes.map((index) => index + 1).join(", ")}
${earlier}`;
}

/**
 * Writes the activity screens a published lesson's revised plan asks for, with the writer's own
 * rules, and nothing else. Each comes back with its 0-based plan screen and the template the plan
 * names; a screen that wasn't asked for is dropped.
 */
export async function writeLessonActivities(params: WriteLessonActivitiesParams) {
  const {
    analytics,
    model = getLessonWriterModel({ reuse: "library" }),
    reasoning,
    serviceTier,
    useFallback = true,
  } = params;

  const instructions = buildSystemPrompt(params);
  const userPrompt = buildUserPrompt(params);

  const providerOptions = buildProviderOptions({
    fallbackModels: WRITER_MODELS,
    model,
    serviceTier,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics,
    generate: () =>
      generateText({
        instructions,
        model,
        output: activitiesOutput.output,
        prompt: userPrompt,
        providerOptions,
        reasoning,
      }),
    libraryInput: true,
    systemPrompt: instructions,
    task: "lesson-activities",
  });

  const asked = new Set(params.indexes);

  const data = result.output.screens.flatMap(({ screen, ...activity }) => {
    const index = screen - 1;
    const template = params.spec.screens[index]?.activityTemplate;

    return asked.has(index) && template ? [{ index, screen: { ...activity, template } }] : [];
  });

  return { data, provenance, systemPrompt: instructions, usage: result.usage, userPrompt };
}
