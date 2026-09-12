import "server-only";
import { Output, generateText } from "ai";
import { z } from "zod";
import { type Reasoning, buildProviderOptions } from "../../provider-options";
import { getPromptLanguageName } from "../_utils/prompt-language";
import systemPrompt from "./course-discovery.prompt.md";

const MAX_PUBLIC_SUBJECT_TITLE_LENGTH = 160;

const defaultModel = "openai/gpt-5.6-luna";

const MAX_VISIBLE_OPTIONS = 5;

const questionSchema = z.object({
  description: z.string(),
  id: z.string().min(1),
  optional: z.boolean(),
  options: z
    .array(z.object({ description: z.string(), id: z.string().min(1), label: z.string().min(1) }))
    .min(2)
    .max(MAX_VISIBLE_OPTIONS),
  question: z.string().min(1),
});

export const courseDiscoveryBriefSchema = z.object({
  description: z.string().min(1),
  learningGoal: z.string().min(1),
  requirements: z.array(z.string().min(1)),
  startingKnowledge: z.string(),
  title: z.string().min(1),
});

const decisionSchema = z.discriminatedUnion("status", [
  z.object({
    brief: z.null(),
    format: z.null(),
    question: questionSchema,
    reusableCoursePrompt: z.null(),
    status: z.literal("ask"),
    targetLanguage: z.null(),
  }),
  z.object({
    brief: courseDiscoveryBriefSchema,
    format: z.enum(["core", "language", "question", "personalized"]),
    question: z.null(),
    reusableCoursePrompt: z
      .string()
      .min(1)
      .max(MAX_PUBLIC_SUBJECT_TITLE_LENGTH)
      .describe(
        "A concise public subject name or narrow question, such as Python or Why is the sky blue? Never a generation instruction, syllabus, description, or learner-specific project.",
      )
      .nullable(),
    status: z.literal("ready"),
    targetLanguage: z.string().nullable(),
  }),
]);

// Keep the provider's root schema an object while making contradictory ask/ready states impossible.
const schema = z.object({ decision: decisionSchema });

export type CourseDiscoveryQuestion = z.infer<typeof questionSchema>;
export type CourseDiscoveryBrief = z.infer<typeof courseDiscoveryBriefSchema>;
export type CourseDiscoveryResult = z.infer<typeof decisionSchema>;
type CourseDiscoveryAnswer = { questionId: string; question: string; answer: string };
export type CourseDiscoveryParams = {
  prompt: string;
  language: string;
  answers: CourseDiscoveryAnswer[];
  interests?: string[];
  model?: string;
  useFallback?: boolean;
  reasoning?: Reasoning;
};

/** Refuse repeated intake and contradictory states before Core persists them. */
function validateDiscovery({
  answers,
  data,
}: {
  answers: CourseDiscoveryAnswer[];
  data: CourseDiscoveryResult;
}): CourseDiscoveryResult {
  if (data.status === "ask") {
    if (
      !data.question ||
      data.brief ||
      data.format ||
      data.reusableCoursePrompt ||
      data.targetLanguage
    ) {
      throw new Error("An intake question cannot also resolve a course");
    }

    if (answers.some((answer) => answer.questionId === data.question?.id)) {
      throw new Error("Discovery repeated an answered question");
    }

    if (
      new Set(data.question.options.map((option) => option.id)).size !==
      data.question.options.length
    ) {
      throw new Error("Discovery options must have distinct identifiers");
    }

    return data;
  }

  if (data.question || !data.brief || !data.format) {
    throw new Error("Completed discovery requires a resolved brief and course format");
  }

  if ((data.format !== "personalized") !== Boolean(data.reusableCoursePrompt?.trim())) {
    throw new Error("Only reusable courses must have a reusable subject prompt");
  }

  if ((data.format === "language") !== Boolean(data.targetLanguage)) {
    throw new Error("Only language courses must have a target language");
  }

  return data;
}

/** Asks one material question at a time without imposing an intake length. */
export async function generateCourseDiscovery({
  prompt,
  language,
  answers,
  interests = [],
  model = defaultModel,
  useFallback = false,
  reasoning,
}: CourseDiscoveryParams) {
  const userPrompt = JSON.stringify({
    ANSWERS: answers,
    LANGUAGE: getPromptLanguageName({ language }),
    OPTIONAL_FAMILIAR_CONTEXTS: interests,
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

  return {
    data: validateDiscovery({ answers, data: output.decision }),
    systemPrompt,
    usage,
    userPrompt,
  };
}
