import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { runTaskGeneration } from "../../provenance/run-task-generation";
import { buildProviderOptions } from "../../provider-options";
import { selectPromptVariants } from "../_utils/prompt-variants";
import { chapterSchema } from "./_utils/course-outline-schema";
import { normalizeDraft } from "./_utils/graph-drafts";
import { normalizeCourseOutline } from "./_utils/normalize-course-outline";
import template from "./goal-opening.prompt.md";
import {
  type SkillGraphParams,
  courseSchema,
  formatGoalPrompt,
  skillSchema,
} from "./skill-graph-calls";

/** The skill graph's and the course outline's model, so the opening reads like the path it starts. */
const defaultModel = "openai/gpt-6.1-terra";
const fallbackModels = ["anthropic/claude-opus-5.5", "google/gemini-3.8-flash"] as const;

const schema = z.object({
  chapter: chapterSchema,
  course: courseSchema,
  skill: skillSchema.omit({
    examWeight: true,
    outcome: true,
    phase: true,
    prerequisites: true,
    topics: true,
  }),
});

export type GoalOpeningParams = Omit<
  SkillGraphParams,
  | "examBlueprint"
  | "findLibrarySkills"
  | "goalKind"
  | "lessonBudget"
  | "librarySkills"
  | "onSkillNamed"
  | "targetLanguage"
> & {
  /** Only when the prompt holds no learner's words: a shared goal's general form. */
  libraryInput?: boolean;
};

function toOpening(raw: z.infer<typeof schema>) {
  const { data: graph } = normalizeDraft({
    params: { goalKind: "learn" },
    raw: {
      courses: [raw.course],
      phases: [{ milestone: "", title: "" }],
      skills: [
        { ...raw.skill, examWeight: null, outcome: false, phase: 1, prerequisites: [], topics: [] },
      ],
    },
  });

  const [skill] = graph.skills;

  const [chapter] = normalizeCourseOutline({
    level: skill?.level ?? raw.skill.level,
    raw: { chapters: [{ ...raw.chapter, skillKeys: skill ? [skill.key] : [] }] },
    requiredSkillKeys: skill ? [skill.key] : [],
  }).chapters;

  if (!skill || !chapter) {
    throw new Error("The goal's opening has no skill or no chapter with lessons.");
  }

  return { chapter, graph, skill };
}

/**
 * A learn goal's first skill, its course and that skill's first chapter, from the same facts the
 * skill graph reads, so the learner's first lesson can be written before the graph is.
 */
export async function generateGoalOpening(params: GoalOpeningParams) {
  const { analytics, model = defaultModel, reasoning, serviceTier, useFallback = true } = params;

  const systemPrompt = selectPromptVariants({
    template,
    variants: { material: Boolean(params.hasMaterial), product: Boolean(params.product) },
  });

  const userPrompt = formatGoalPrompt({ ...params, goalKind: "learn" });
  const providerOptions = buildProviderOptions({ fallbackModels, model, serviceTier, useFallback });

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
    libraryInput: Boolean(params.libraryInput),
    systemPrompt,
    task: "goal-opening",
  });

  return {
    data: toOpening(result.output),
    provenance,
    systemPrompt,
    usage: result.usage,
    userPrompt,
  };
}
