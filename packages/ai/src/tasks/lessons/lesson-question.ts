import "server-only";
import { type Reasoning, buildProviderOptions } from "@zoonk/ai/provider-options";
import { generateText, streamText } from "ai";
import { type AiGenerationContext } from "../../provenance/ai-generation-event";
import { runTaskGeneration, startTaskGeneration } from "../../provenance/run-task-generation";
import { type TaskProvenance } from "../../provenance/task-provenance";
import beyondLessonPrompt from "./lesson-question-beyond.prompt.md";
import chapterPrompt from "./lesson-question-chapter.prompt.md";
import {
  type LessonQuestionContextSnapshot,
  type PlanScopeContext,
} from "./lesson-question-context";
import lessonPrompt from "./lesson-question-lesson.prompt.md";
import mockPrompt from "./lesson-question-mock.prompt.md";
import systemPrompt from "./lesson-question.prompt.md";

export const LESSON_QUESTION_MODEL = "openai/gpt-6-luna";
/**
 * Haiku first: in the memory eval it was the fallback that never forced an unrelated memory fact
 * into an answer. Flash Lite stays last as the cheapest option.
 */
const fallbackModels = ["anthropic/claude-haiku-5.5", "google/gemini-3.1-flash-lite"] as const;
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty lesson question answer";
const LESSON_QUESTION_TASK = "lesson-question";

export type LessonQuestionPriorTurn = { answer: string; question: string };

type LessonTutorContextSnapshot = Exclude<LessonQuestionContextSnapshot, PlanScopeContext>;

const SCOPE_PROMPTS = {
  answer: lessonPrompt,
  chapter: `${beyondLessonPrompt}\n${chapterPrompt}`,
  lesson: lessonPrompt,
  mock: `${beyondLessonPrompt}\n${mockPrompt}`,
  step: lessonPrompt,
} satisfies Record<LessonTutorContextSnapshot["scope"]["kind"], string>;

function getSystemPrompt(contextSnapshot: LessonTutorContextSnapshot): string {
  return `${systemPrompt}\n${SCOPE_PROMPTS[contextSnapshot.scope.kind]}`;
}

export type LessonQuestionAnswerCompletion = {
  answer: string;
  finishReason: string;
  generatedAt: string;
  model: string;
  promptVersion: string;
  provider: string;
  runId: string;
};

type StreamLessonQuestionAnswerParams = {
  analytics?: AiGenerationContext;
  contextSnapshot: LessonTutorContextSnapshot;
  /** Only when memory is on. */
  learnerMemory?: readonly string[];
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
};

export type GenerateLessonQuestionAnswerParams = {
  analytics?: AiGenerationContext;
  contextSnapshot: LessonTutorContextSnapshot;
  learnerMemory?: readonly string[];
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

function createLearnerMemoryLines(learnerMemory: readonly string[]): string[] {
  if (learnerMemory.length === 0) {
    return [];
  }

  return ["<LEARNER_MEMORY>", ...learnerMemory.map((fact) => `- ${fact}`), "</LEARNER_MEMORY>"];
}

function createCurrentQuestionMessage({
  contextSnapshot,
  learnerMemory,
  question,
}: {
  contextSnapshot: LessonTutorContextSnapshot;
  learnerMemory: readonly string[];
  question: string;
}) {
  return {
    content: [
      "<CURRENT_CONTEXT>",
      JSON.stringify(contextSnapshot),
      "</CURRENT_CONTEXT>",
      ...createLearnerMemoryLines(learnerMemory),
      "<LEARNER_QUESTION>",
      question,
      "</LEARNER_QUESTION>",
    ].join("\n"),
    role: "user" as const,
  };
}

function createLessonQuestionMessages({
  contextSnapshot,
  learnerMemory,
  priorTurns,
  question,
}: {
  contextSnapshot: LessonTutorContextSnapshot;
  learnerMemory: readonly string[];
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
}) {
  return [
    ...toHistoryMessages(priorTurns),
    createCurrentQuestionMessage({ contextSnapshot, learnerMemory, question }),
  ];
}

function createLessonQuestionGenerationOptions({
  contextSnapshot,
  learnerMemory = [],
  model,
  priorTurns,
  question,
  reasoning,
  useFallback,
}: {
  contextSnapshot: LessonTutorContextSnapshot;
  learnerMemory?: readonly string[];
  model: string;
  priorTurns: readonly LessonQuestionPriorTurn[];
  question: string;
  reasoning?: Reasoning;
  useFallback: boolean;
}) {
  return {
    instructions: getSystemPrompt(contextSnapshot),
    messages: createLessonQuestionMessages({
      contextSnapshot,
      learnerMemory,
      priorTurns,
      question,
    }),
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

export async function generateLessonQuestionAnswer({
  analytics,
  contextSnapshot,
  learnerMemory,
  model = LESSON_QUESTION_MODEL,
  priorTurns,
  question,
  reasoning,
  useFallback = true,
}: GenerateLessonQuestionAnswerParams) {
  const generationOptions = createLessonQuestionGenerationOptions({
    contextSnapshot,
    learnerMemory,
    model,
    priorTurns,
    question,
    reasoning,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics: { contentScope: "personal", ...analytics },
    generate: () => generateText(generationOptions),
    systemPrompt: generationOptions.instructions,
    task: LESSON_QUESTION_TASK,
  });

  if (!result.text.trim()) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  return {
    data: { answer: result.text },
    provenance,
    systemPrompt: generationOptions.instructions,
    usage: result.usage,
    userPrompt: serializeLessonQuestionMessages(generationOptions.messages),
  };
}

/**
 * `provenance` resolves once the answer ends; it rejects when the stream fails, which the adapter
 * reads from the stream itself.
 */
export function streamLessonQuestionAnswer({
  analytics,
  contextSnapshot,
  learnerMemory,
  priorTurns,
  question,
}: StreamLessonQuestionAnswerParams): {
  generation: ReturnType<typeof streamText>;
  provenance: Promise<TaskProvenance>;
} {
  const run = startTaskGeneration({
    analytics: { contentScope: "personal", ...analytics },
    systemPrompt: getSystemPrompt(contextSnapshot),
    task: LESSON_QUESTION_TASK,
  });

  const generation = streamText({
    ...createLessonQuestionGenerationOptions({
      contextSnapshot,
      learnerMemory,
      model: LESSON_QUESTION_MODEL,
      priorTurns,
      question,
      useFallback: true,
    }),
    onError: suppressLessonQuestionProviderError,
  });

  const provenance = Promise.all([generation.finalStep, generation.steps, generation.usage]).then(
    ([finalStep, steps, usage]) => run.finish({ finalStep, steps, usage }),
  );

  // A failed stream rejects this too; nothing else may be waiting for it.
  void provenance.catch(() => null);

  return { generation, provenance };
}
