import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { generateText, streamText } from "ai";
import systemPrompt from "./lesson-question.prompt.md";

export const LESSON_QUESTION_MODEL = "openai/gpt-5.6-luna";
const fallbackModels = ["google/gemini-3.1-flash-lite"] as const;
const configuredModels = [LESSON_QUESTION_MODEL, ...fallbackModels];
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";

export type LessonQuestionStepContext = {
  content: unknown;
  kind: string;
  sentence: {
    explanation: string | null;
    romanization: string | null;
    sentence: string;
    translation: string;
  } | null;
  stepNumber: number;
  word: {
    pronunciation: string | null;
    romanization: string | null;
    translation: string;
    word: string;
  } | null;
};

export type LessonQuestionContextSnapshot = {
  answer: {
    correctAnswer: string | null;
    feedback: string | null;
    isCorrect: boolean;
    selectedAnswer: string;
  } | null;
  chapter: { description: string | null; title: string };
  course: {
    description: string | null;
    language: string;
    targetLanguage: string | null;
    title: string;
  };
  lesson: { description: string | null; kind: string; language: string; title: string | null };
  lessonSteps: LessonQuestionStepContext[];
  scope: { kind: "answer" | "lesson" | "step" };
  step: LessonQuestionStepContext | null;
  version: 1;
};

export type LessonQuestionPriorTurn = { answer: string; question: string };

export type LessonQuestionAnswerCompletion = {
  answer: string;
  finishReason: string;
  inputTokens?: number;
  model: string;
  outputTokens?: number;
  provider: string;
  totalTokens?: number;
};

type StreamLessonQuestionAnswerParams = {
  contextSnapshot: LessonQuestionContextSnapshot;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
};

export type GenerateLessonQuestionAnswerParams = {
  contextSnapshot: LessonQuestionContextSnapshot;
  model?: string;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

export type LessonQuestionAnswerSchema = { answer: string };

function toHistoryMessages(priorTurns: readonly LessonQuestionPriorTurn[]) {
  return priorTurns.flatMap(({ answer, question }) => [
    { content: question, role: "user" as const },
    { content: answer, role: "assistant" as const },
  ]);
}

function createCurrentQuestionMessage({
  contextSnapshot,
  question,
}: {
  contextSnapshot: LessonQuestionContextSnapshot;
  question: string;
}) {
  return {
    content: [
      "<CURRENT_CONTEXT>",
      JSON.stringify(contextSnapshot),
      "</CURRENT_CONTEXT>",
      "<LEARNER_QUESTION>",
      question,
      "</LEARNER_QUESTION>",
    ].join("\n"),
    role: "user" as const,
  };
}

function createLessonQuestionMessages({
  contextSnapshot,
  priorTurns,
  question,
}: {
  contextSnapshot: LessonQuestionContextSnapshot;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
}) {
  return [
    ...toHistoryMessages(priorTurns),
    createCurrentQuestionMessage({ contextSnapshot, question }),
  ];
}

function createLessonQuestionGenerationOptions({
  contextSnapshot,
  model,
  priorTurns,
  question,
  reasoning,
  useFallback,
}: {
  contextSnapshot: LessonQuestionContextSnapshot;
  model: string;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
  reasoning?: Reasoning;
  useFallback: boolean;
}) {
  return {
    instructions: systemPrompt,
    maxOutputTokens: 600,
    messages: createLessonQuestionMessages({ contextSnapshot, priorTurns, question }),
    model,
    providerOptions: buildProviderOptions({ fallbackModels, model, useFallback }),
    reasoning,
  };
}

function serializeLessonQuestionMessages(
  messages: ReturnType<typeof createLessonQuestionMessages>,
): string {
  return messages.map(({ content, role }) => `${role.toUpperCase()}:\n${content}`).join("\n\n");
}

/** Provider errors can contain private prompt data; the delivery adapter logs safe identifiers. */
function suppressLessonQuestionProviderError() {
  return Promise.resolve();
}

/**
 * Runs the same grounded tutor task without streaming so the eval app can choose
 * a model and persist the complete prompt, output, and usage for comparison.
 */
export async function generateLessonQuestionAnswer({
  contextSnapshot,
  model = LESSON_QUESTION_MODEL,
  priorTurns,
  question,
  reasoning,
  useFallback = true,
}: GenerateLessonQuestionAnswerParams) {
  const generationOptions = createLessonQuestionGenerationOptions({
    contextSnapshot,
    model,
    priorTurns,
    question,
    reasoning,
    useFallback,
  });

  const { text, usage } = await generateText(generationOptions);

  if (!text.trim()) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  return {
    data: { answer: text },
    systemPrompt,
    usage,
    userPrompt: serializeLessonQuestionMessages(generationOptions.messages),
  };
}

export function resolveLessonQuestionAnswerModel({
  modelId,
  provider,
}: {
  modelId: string;
  provider: string;
}) {
  const configuredModel = configuredModels.find(
    (candidate) => candidate === modelId || candidate.endsWith(`/${modelId}`),
  );

  const model = configuredModel ?? modelId;
  const providerSeparator = model.indexOf("/");

  return { model, provider: providerSeparator > 0 ? model.slice(0, providerSeparator) : provider };
}

/**
 * Keeps the model and fallback policy in the task while delivery adapters choose
 * how to stream and persist the generated response.
 */
export function streamLessonQuestionAnswer({
  contextSnapshot,
  priorTurns,
  question,
}: StreamLessonQuestionAnswerParams) {
  const generationOptions = createLessonQuestionGenerationOptions({
    contextSnapshot,
    model: LESSON_QUESTION_MODEL,
    priorTurns,
    question,
    useFallback: true,
  });

  return streamText({ ...generationOptions, onError: suppressLessonQuestionProviderError });
}
