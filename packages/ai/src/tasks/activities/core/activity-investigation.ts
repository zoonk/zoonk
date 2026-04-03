import "server-only";
import { type ReasoningEffort, buildProviderOptions } from "@zoonk/ai/provider-options";
import { Output, generateText } from "ai";
import { z } from "zod";
import systemPrompt from "./activity-investigation.prompt.md";

const DEFAULT_MODEL = process.env.AI_MODEL_ACTIVITY_INVESTIGATION ?? "openai/gpt-5.4";
const FALLBACK_MODELS = ["anthropic/claude-opus-4.6", "google/gemini-3.1-pro-preview"];

const investigationVisualKindSchema = z.enum([
  "chart",
  "code",
  "diagram",
  "formula",
  "image",
  "table",
  "timeline",
]);

const investigationFindingSchema = z.object({
  feedback: z.string(),
  text: z.string(),
  visualDescription: z.string(),
  visualKind: investigationVisualKindSchema,
});

const investigationActionSchema = z.object({
  correctTag: z.enum(["supports", "contradicts", "inconclusive"]),
  finding: investigationFindingSchema,
  label: z.string(),
  quality: z.enum(["critical", "useful", "weak"]),
});

const investigationConclusionSchema = z.object({
  quality: z.enum(["overclaims", "ignoresEvidence", "honest", "best"]),
  text: z.string(),
});

const schema = z.object({
  actions: z.array(investigationActionSchema),
  conclusions: z.array(investigationConclusionSchema),
  correctExplanationIndex: z.number().int().min(0),
  debrief: z.object({
    fullExplanation: z.string(),
  }),
  scenario: z.object({
    explanations: z.array(z.object({ text: z.string() })),
    text: z.string(),
    visualDescription: z.string(),
    visualKind: investigationVisualKindSchema,
  }),
});

export type ActivityInvestigationSchema = z.infer<typeof schema>;

export type ActivityInvestigationParams = {
  topic: string;
  language: string;
  concepts: string[];
  courseTitle?: string;
  chapterTitle?: string;
  lessonDescription?: string;
  model?: string;
  useFallback?: boolean;
  reasoningEffort?: ReasoningEffort;
};

/**
 * Generates a complete investigation scenario for a lesson.
 * Produces a mystery with a scenario, explanations, investigation
 * actions with ambiguous findings, conclusion statements, and a debrief.
 * Each finding includes a visual description and kind for a separate
 * visual generation task to produce the actual visual content.
 */
export async function generateActivityInvestigation({
  topic,
  language,
  concepts,
  courseTitle,
  chapterTitle,
  lessonDescription,
  model = DEFAULT_MODEL,
  useFallback = true,
  reasoningEffort,
}: ActivityInvestigationParams) {
  const userPrompt = `
    TOPIC: ${topic}
    LANGUAGE: ${language}
    COURSE_TITLE: ${courseTitle ?? ""}
    CHAPTER_TITLE: ${chapterTitle ?? ""}
    LESSON_DESCRIPTION: ${lessonDescription ?? ""}
    CONCEPTS: ${concepts.join(", ")}
  `;

  const providerOptions = buildProviderOptions({
    fallbackModels: FALLBACK_MODELS,
    reasoningEffort,
    useFallback,
  });

  const { output, usage } = await generateText({
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions,
    system: systemPrompt,
  });

  return { data: output, systemPrompt, usage, userPrompt };
}
