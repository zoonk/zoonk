import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import intentPrompt from "./course-intent.prompt.md";
import requestPrompt from "./course-request.prompt.md";

const MAX_PUBLIC_SUBJECT_TITLE_LENGTH = 160;

const defaultModel = "openai/gpt-5.6-luna";
const systemPrompt = `${intentPrompt}\n\n${requestPrompt}`;

const subjectSchema = z.object({
  format: z.enum(["core", "language", "question"]),
  prompt: z.string().min(1),
  requiresDiscovery: z.boolean(),
  targetLanguage: z.string().nullable(),
  title: z.string().min(1).max(MAX_PUBLIC_SUBJECT_TITLE_LENGTH),
});

const schema = z.object({
  intent: z.enum(["unsafe", "exam", "question", "learn", "ambiguous"]),
  subjects: z.array(subjectSchema),
  trackTitle: z.string().nullable(),
});

export type LearningRequestSubject = z.infer<typeof subjectSchema>;
export type LearningRequestResolution = z.infer<typeof schema>;
export type LearningRequestParams = {
  prompt: string;
  language: string;
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** Routing never converts an unsupported or unresolved request into a course. */
function validateResolution(data: LearningRequestResolution): LearningRequestResolution {
  if (data.intent === "unsafe" || data.intent === "exam" || data.intent === "ambiguous") {
    return { intent: data.intent, subjects: [], trackTitle: null };
  }

  if (data.subjects.length === 0) {
    throw new Error("A learning request must resolve at least one subject");
  }

  if (
    data.subjects.some(
      (subject) => (subject.format === "language") !== Boolean(subject.targetLanguage),
    )
  ) {
    throw new Error("Only language subjects must have a target language");
  }

  const identities = data.subjects.map(
    (subject) =>
      `${subject.format}:${subject.title.trim().toLocaleLowerCase()}:${subject.targetLanguage ?? ""}`,
  );

  if (new Set(identities).size !== identities.length) {
    throw new Error("A learning request cannot contain duplicate subjects");
  }

  return { ...data, trackTitle: data.subjects.length > 1 ? data.trackTitle : null };
}

/** Resolves intent and distinct subjects before reusable identity or private intake. */
export async function resolveLearningRequest({
  prompt,
  language,
  model = defaultModel,
  useFallback = false,
  reasoning,
}: LearningRequestParams) {
  const userPrompt = JSON.stringify({
    LANGUAGE: getPromptLanguageName({ language }),
    USER_INPUT: prompt,
  });

  const { output, usage } = await generateText({
    instructions: systemPrompt,
    model,
    output: Output.object({ schema }),
    prompt: userPrompt,
    providerOptions: buildProviderOptions({ fallbackModels: [], model, useFallback }),
    reasoning,
  });

  return { data: validateResolution(output), systemPrompt, usage, userPrompt };
}
