import "server-only";
import { generateText, isStepCount, streamText } from "ai";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration, startTaskGeneration } from "../../../provenance/run-task-generation";
import { type TaskProvenance } from "../../../provenance/task-provenance";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type LessonQuestionPriorTurn } from "../../lessons/lesson-question";
import {
  type PlanScopeContext,
  type TutorScreenContext,
} from "../../lessons/lesson-question-context";
import {
  type OfferGoalAppTool,
  type ProposeGoalPlanChange,
  createCardTools,
} from "./goal-tutor-cards";
import chapterScreenPrompt from "./goal-tutor-chapter.prompt.md";
import examGoalPrompt from "./goal-tutor-exam.prompt.md";
import itemScreenPrompt from "./goal-tutor-item.prompt.md";
import { selectAppLanguageNames } from "./goal-tutor-language";
import lessonScreenPrompt from "./goal-tutor-lesson.prompt.md";
import { LOOKUP_DEADLINE_MS, type LookUpGoalData, createLookUpTool } from "./goal-tutor-lookup";
import { createGoalTutorMessages, serializeGoalTutorMessages } from "./goal-tutor-messages";
import mockScreenPrompt from "./goal-tutor-mock.prompt.md";
import { type GoalTutorLinks, formatGoalTutorPageGuide } from "./goal-tutor-pages";
import { shouldSearchFirst } from "./goal-tutor-search";
import subjectScreenPrompt from "./goal-tutor-subject.prompt.md";
import { SEARCH_DEADLINE_MS, createSearchWebTool } from "./goal-tutor-web-search";
import systemPrompt from "./goal-tutor.prompt.md";

/**
 * Luna matched Gemini 3.8 Flash on the goal-tutor eval at a twentieth of the cost (7 Oct 2026),
 * with 91% of its input read from OpenAI's prompt cache on real threads.
 */
export const GOAL_TUTOR_MODEL = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-sonnet-5.5"] as const;
const GOAL_TUTOR_TASK = "goal-tutor";

/**
 * A search, a lookup, a round of card tools, the answer, and one more round for an app tool after a
 * change (`changeFirst`). A search is a step of its own: its tool runs in the app.
 */
const MAX_STEPS = 5;

/**
 * Left to its own judgment the buddy answered from outdated law (STF, ADI 1194), so a classifier
 * (`shouldSearchFirst`) makes the first step search. The model only proposes the queries: what
 * goes out holds none of the learner's data.
 */
const SEARCH_TOOL = "searchWeb";
const LOOKUP_TOOL = "lookUp";
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty goal tutor answer";

type GoalTutorInput = {
  analytics?: AiGenerationContext;
  contextSnapshot: PlanScopeContext;
  /** Only when memory is on. */
  learnerMemory?: readonly string[];
  /** Never sent to a web search, and never in the model's context. */
  learnerNames?: readonly string[];
  /** The buddy links only what it's given, copied as it reads it. */
  links: GoalTutorLinks;
  /** Only the model sees what it finds. */
  lookUp: LookUpGoalData;
  offerAppTool: OfferGoalAppTool;
  priorTurns: readonly LessonQuestionPriorTurn[];
  proposePlanChange: ProposeGoalPlanChange;
  question: string;
};

export type GenerateGoalTutorAnswerParams = GoalTutorInput & {
  model?: string;
  reasoning?: Reasoning;
  useFallback?: boolean;
};

function createTools({
  analytics,
  contextSnapshot,
  learnerMemory,
  learnerNames,
  links,
  lookUp,
  offerAppTool,
  proposePlanChange,
}: GoalTutorInput) {
  return {
    [SEARCH_TOOL]: createSearchWebTool({ analytics, contextSnapshot, learnerMemory, learnerNames }),
    ...createCardTools({ offerAppTool, proposePlanChange }),
    [LOOKUP_TOOL]: createLookUpTool({ links, lookUp }),
  };
}

/**
 * A lookup and a search have deadlines, past which the buddy answers without them; the card tools
 * wait for core, whose result the card shows.
 */
const TOOL_TIMEOUT = { tools: { lookUpMs: LOOKUP_DEADLINE_MS, searchWebMs: SEARCH_DEADLINE_MS } };

/**
 * Every step sends the same tools and thinking, which a provider's cache keys on, except that steps
 * after a search or a lookup can't search: after a lookup, this keeps the model from even proposing
 * what it found. The last step only answers, so a message never ends on tool calls.
 */
function createPrepareStep({
  searchFirst,
  toolNames,
}: {
  searchFirst: Promise<boolean>;
  toolNames: (keyof ReturnType<typeof createTools>)[];
}) {
  return async ({
    stepNumber,
    steps,
  }: {
    stepNumber: number;
    steps: readonly { toolCalls: readonly { toolName: string }[] }[];
  }) => {
    if (stepNumber === MAX_STEPS - 1) {
      return { toolChoice: "none" as const };
    }

    if (stepNumber === 0 && (await searchFirst)) {
      return { toolChoice: { toolName: SEARCH_TOOL, type: "tool" } as const };
    }

    const searchedOrLookedUp = steps.some((step) =>
      step.toolCalls.some((call) => call.toolName === SEARCH_TOOL || call.toolName === LOOKUP_TOOL),
    );

    return searchedOrLookedUp
      ? { activeTools: toolNames.filter((name) => name !== SEARCH_TOOL) }
      : {};
  };
}

/** A goal's kind stays the same for a whole conversation, so its messages share a cached prompt. */
const examSystemPrompt = `${systemPrompt}\n${examGoalPrompt}`;

/** A thread stays on one screen, so its messages share a cached prompt. */
const SCREEN_PROMPTS = {
  answer: lessonScreenPrompt,
  chapter: chapterScreenPrompt,
  item: itemScreenPrompt,
  lesson: lessonScreenPrompt,
  mock: mockScreenPrompt,
  step: lessonScreenPrompt,
  subject: subjectScreenPrompt,
} satisfies Record<TutorScreenContext["scope"]["kind"], string>;

function getPageGuide({
  contextSnapshot,
  links,
}: Pick<GoalTutorInput, "contextSnapshot" | "links">) {
  const guide = formatGoalTutorPageGuide({
    pages: links.pages,
    selectedGoal: contextSnapshot.selectedGoal === true,
  });

  return `## The app's pages\n\n${guide}\n`;
}

function getSystemPrompt({
  contextSnapshot,
  links,
}: Pick<GoalTutorInput, "contextSnapshot" | "links">): string {
  const template = contextSnapshot.goal.kind === "exam" ? examSystemPrompt : systemPrompt;
  const goalPrompt = selectAppLanguageNames({ language: contextSnapshot.language, template });
  const withPages = `${goalPrompt}\n${getPageGuide({ contextSnapshot, links })}`;
  const { screen } = contextSnapshot;

  return screen ? `${withPages}\n${SCREEN_PROMPTS[screen.scope.kind]}` : withPages;
}

/**
 * A language goal's doubts are about the language itself, which never changes, so they skip the
 * classifier's half second; the buddy can still search on its own.
 */
function needsSearchDecision(contextSnapshot: PlanScopeContext): boolean {
  return contextSnapshot.goal.kind !== "language";
}

function createGenerationOptions({
  analytics,
  model,
  reasoning,
  useFallback,
  ...input
}: GoalTutorInput & { model: string; reasoning?: Reasoning; useFallback: boolean }) {
  const searchFirst = needsSearchDecision(input.contextSnapshot)
    ? shouldSearchFirst({
        analytics,
        earlierQuestion: input.priorTurns.at(-1)?.question ?? null,
        goal: input.contextSnapshot.goal.title,
        question: input.question,
      })
    : Promise.resolve(false);

  const tools = createTools({ ...input, analytics });

  return {
    instructions: getSystemPrompt(input),
    messages: createGoalTutorMessages(input),
    model,
    prepareStep: createPrepareStep({
      searchFirst,
      toolNames: Object.keys(tools).filter((name): name is keyof typeof tools => name in tools),
    }),
    providerOptions: buildProviderOptions({ fallbackModels, model, useFallback }),
    reasoning,
    stopWhen: isStepCount(MAX_STEPS),
    timeout: TOOL_TIMEOUT,
    tools,
  };
}

/** Every step's words, so the text before and after a proposal both reach the learner. */
export function joinStepTexts(steps: readonly { text: string }[]): string {
  return steps
    .map((step) => step.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/** Provider errors can contain private prompt data; the delivery adapter logs safe identifiers. */
function suppressProviderError() {
  return Promise.resolve();
}

/** For evals: the same prompt, tools and steps, without streaming. */
export async function generateGoalTutorAnswer({
  analytics,
  model = GOAL_TUTOR_MODEL,
  reasoning,
  useFallback = true,
  ...input
}: GenerateGoalTutorAnswerParams) {
  const context = { contentScope: "personal" as const, ...analytics };

  const options = createGenerationOptions({
    ...input,
    analytics: context,
    model,
    reasoning,
    useFallback,
  });

  const { provenance, result } = await runTaskGeneration({
    analytics: context,
    generate: () => generateText(options),
    systemPrompt: options.instructions,
    task: GOAL_TUTOR_TASK,
  });

  const answer = joinStepTexts(result.steps);

  if (!answer) {
    throw new Error(EMPTY_ANSWER_MESSAGE);
  }

  // What actually went out to the search provider, so evals see when the buddy looked a fact up
  // and with which words.
  const searches = result.steps.flatMap((step) =>
    step.staticToolResults.flatMap((toolResult) =>
      toolResult.toolName === SEARCH_TOOL && toolResult.output.status === "found"
        ? toolResult.output.searched.map((searched) => JSON.stringify(searched))
        : [],
    ),
  );

  return {
    data: { answer, searches },
    provenance,
    systemPrompt: options.instructions,
    usage: result.usage,
    userPrompt: serializeGoalTutorMessages(options.messages),
  };
}

/**
 * A plan change is applied only after the learner's tap. `provenance` resolves once the answer
 * ends and rejects when the stream fails.
 */
export function streamGoalTutorAnswer({ analytics, ...input }: GoalTutorInput) {
  const context = { contentScope: "personal" as const, ...analytics };

  const run = startTaskGeneration({
    analytics: context,
    systemPrompt: getSystemPrompt(input),
    task: GOAL_TUTOR_TASK,
  });

  const generation = streamText({
    ...createGenerationOptions({
      ...input,
      analytics: context,
      model: GOAL_TUTOR_MODEL,
      useFallback: true,
    }),
    onError: suppressProviderError,
  });

  const provenance = Promise.all([generation.finalStep, generation.steps, generation.usage]).then(
    ([finalStep, steps, usage]) => run.finish({ finalStep, steps, usage }),
  );

  // A failed stream rejects this too; nothing else may be waiting for it.
  void provenance.catch(() => null);

  return { generation, provenance: provenance satisfies Promise<TaskProvenance> };
}
