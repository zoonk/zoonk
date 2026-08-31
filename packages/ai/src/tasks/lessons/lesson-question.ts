import "server-only";
import { zoonkGateway } from "@zoonk/ai/gateway";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { type TextStreamPart, type ToolSet, generateText, streamText } from "ai";
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
  onEnd: (completion: LessonQuestionAnswerCompletion) => Promise<void> | void;
  onError: (error: unknown) => Promise<void> | void;
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

type GenerationState = {
  failure: { error: unknown; settled: Promise<void> } | null;
  routedModel: { model: string; provider: string } | null;
};

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
  reasoning: Reasoning | undefined;
  useFallback: boolean;
}) {
  return {
    instructions: systemPrompt,
    maxOutputTokens: 600,
    messages: createLessonQuestionMessages({ contextSnapshot, priorTurns, question }),
    model: zoonkGateway(model),
    providerOptions: buildProviderOptions({ fallbackModels, model, useFallback }),
    reasoning,
  };
}

function serializeLessonQuestionMessages(
  messages: ReturnType<typeof createLessonQuestionMessages>,
): string {
  return messages.map(({ content, role }) => `${role.toUpperCase()}:\n${content}`).join("\n\n");
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

function getRoutedModel({ modelId, provider }: { modelId: string; provider: string }) {
  const configuredModel = configuredModels.find(
    (candidate) => candidate === modelId || candidate.endsWith(`/${modelId}`),
  );

  const model = configuredModel ?? modelId;
  const providerSeparator = model.indexOf("/");

  return { model, provider: providerSeparator > 0 ? model.slice(0, providerSeparator) : provider };
}

async function waitForErrorHandling(settled: Promise<void>) {
  try {
    await settled;
  } catch {
    // The raw response keeps the original generation or persistence error.
  }
}

/**
 * Raw text has no error envelope, so provider failures must reject the response
 * body instead of looking like a successfully completed empty answer.
 */
function createAnswerTextStream({
  generationState,
  reportError,
  stream,
}: {
  generationState: GenerationState;
  reportError: (error: unknown) => Promise<void>;
  stream: ReadableStream<TextStreamPart<ToolSet>>;
}) {
  const answerState = { hasText: false };

  return stream.pipeThrough(
    new TransformStream<TextStreamPart<ToolSet>, string>({
      async flush(controller) {
        if (generationState.failure) {
          await waitForErrorHandling(generationState.failure.settled);
          controller.error(generationState.failure.error);
          return;
        }

        if (!answerState.hasText) {
          const error = new Error(EMPTY_ANSWER_MESSAGE);

          await reportError(error);
          controller.error(error);
        }
      },
      async transform(part, controller) {
        if (part.type === "text-delta") {
          answerState.hasText ||= part.text.trim().length > 0;
          controller.enqueue(part.text);
        }

        if (part.type === "error") {
          await reportError(part.error);
          controller.error(part.error);
        }
      },
    }),
  );
}

/**
 * Streams one bounded, lesson-grounded tutor response while keeping the model
 * and fallback policy out of delivery adapters. Persistence remains caller-owned
 * so the API can protect retries with the question's claimed revision.
 */
export function streamLessonQuestionAnswer({
  contextSnapshot,
  onEnd,
  onError,
  priorTurns,
  question,
}: StreamLessonQuestionAnswerParams) {
  const generationState: GenerationState = { failure: null, routedModel: null };

  const reportError = async (error: unknown) => {
    if (generationState.failure) {
      await waitForErrorHandling(generationState.failure.settled);
      return;
    }

    const settled = Promise.resolve().then(() => onError(error));

    generationState.failure = { error, settled };
    await waitForErrorHandling(settled);
  };

  const generationOptions = createLessonQuestionGenerationOptions({
    contextSnapshot,
    model: LESSON_QUESTION_MODEL,
    priorTurns,
    question,
    reasoning: "minimal",
    useFallback: true,
  });

  const generation = streamText({
    ...generationOptions,
    onEnd: async ({ finishReason, model, text, usage }) => {
      if (generationState.failure) {
        return;
      }

      if (!text.trim()) {
        await reportError(new Error(EMPTY_ANSWER_MESSAGE));
        return;
      }

      const routedModel =
        generationState.routedModel ??
        getRoutedModel({ modelId: model.modelId, provider: model.provider });

      try {
        await onEnd({
          answer: text,
          finishReason,
          ...(usage.inputTokens === undefined ? {} : { inputTokens: usage.inputTokens }),
          model: routedModel.model,
          ...(usage.outputTokens === undefined ? {} : { outputTokens: usage.outputTokens }),
          provider: routedModel.provider,
          ...(usage.totalTokens === undefined ? {} : { totalTokens: usage.totalTokens }),
        });
      } catch (error) {
        await reportError(error);
      }
    },
    onError: async ({ error }) => {
      await reportError(error);
    },
    onLanguageModelCallEnd: ({ modelId, provider }) => {
      generationState.routedModel = getRoutedModel({ modelId, provider });
    },
  });

  return {
    consumeStream: () => generation.consumeStream(),
    stream: createAnswerTextStream({ generationState, reportError, stream: generation.stream }),
  };
}
