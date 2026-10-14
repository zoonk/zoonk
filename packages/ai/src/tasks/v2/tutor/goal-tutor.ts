import "server-only";
import { generateText, isStepCount, streamText } from "ai";
import { zoonkGateway } from "../../../gateway";
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
import lessonScreenPrompt from "./goal-tutor-lesson.prompt.md";
import { LOOKUP_DEADLINE_MS, type LookUpGoalData, createLookUpTool } from "./goal-tutor-lookup";
import { createGoalTutorMessages, serializeGoalTutorMessages } from "./goal-tutor-messages";
import mockScreenPrompt from "./goal-tutor-mock.prompt.md";
import { type GoalTutorLinks, formatGoalTutorPageGuide } from "./goal-tutor-pages";
import { shouldSearchFirst } from "./goal-tutor-search";
import subjectScreenPrompt from "./goal-tutor-subject.prompt.md";
import systemPrompt from "./goal-tutor.prompt.md";

/**
 * OpenAI's most efficient model ("focused, high-volume tasks"; models page, 7 Oct 2026), at its
 * default medium reasoning. The buddy answers doubts about any goal's subject from its own
 * knowledge and decides when the learner asks for a plan change. On the goal-tutor eval (30 cases,
 * 7 Oct 2026) Luna scored 9.07 against Gemini 3.8 Flash's 9.03, at $0.51 per 1,000 runs against
 * $11.97, p50 10.0s against 10.2s (with searches and tool rounds). On six real threads replayed
 * three messages each, a message cost $0.00065 on average against $0.0127 for Gemini 3.8 Flash,
 * with 91% of its input read from OpenAI's prompt cache. Earlier, cheaper settings lost quality:
 * Gemini 3.5 Flash-Lite 8.58 against 8.89, and low thinking on plan changes. Gemini 3.8 Flash
 * (Google, whose credits the app has) answers when OpenAI fails, then Sonnet 5.5 (Anthropic).
 * Claude Haiku 5.5 scored 8.60 against Luna's 9.61 on 6 cases (7 Oct 2026), at $1.62 per 1,000
 * runs against $0.49.
 */
export const GOAL_TUTOR_MODEL = "openai/gpt-6-luna";
const fallbackModels = ["google/gemini-3.8-flash", "anthropic/claude-sonnet-5.5"] as const;
const GOAL_TUTOR_TASK = "goal-tutor";

/**
 * A lookup of the learner's data the context doesn't show, a round of card tools (a plan change,
 * an app tool), the answer that says it, and room for one more round when the model offers an app
 * tool after the change, or again after a change that showed no card (`changeFirst`): at most four
 * steps. A search runs inside a step, on the gateway.
 */
const MAX_STEPS = 4;

/**
 * A search finds a current source for a fact that changes over time (case law, a recent law, an
 * exam rule the notice doesn't give): a few short excerpts keep it to one search's tokens. Left to
 * its own judgment the buddy skipped the search for a learner's own wording of a doubt whose law a
 * ruling changed (STF, ADI 1194) and answered from outdated law, so a classifier
 * (`shouldSearchFirst`) makes the first step search; with it, the buddy searched both law cases
 * and not a question about the plan, and answered all three right (eval, 7 Oct 2026). Each search
 * adds the gateway's Parallel fee, about $0.005, to the message. The tool isn't named
 * `web_search`: through the gateway, OpenAI reads a required tool by that name as its own built-in
 * search and rejects the request ("Tool choice 'web_search_preview' not found").
 */
const SEARCH_TOOL = "searchWeb";
const LOOKUP_TOOL = "lookUp";
const SEARCH_RESULTS = 5;
const SEARCH_CHARACTERS_PER_RESULT = 1500;
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty goal tutor answer";

type GoalTutorInput = {
  analytics?: AiGenerationContext;
  contextSnapshot: PlanScopeContext;
  /** Facts the learner shared before (their goals, routine, how they learn), when memory is on. */
  learnerMemory?: readonly string[];
  /**
   * How the host links its own pages and what the context and lookups point at: the buddy links
   * only what it's given, copied as it reads it.
   */
  links: GoalTutorLinks;
  /** Reads the learner's own data the context doesn't show; only the model sees what it finds. */
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
  links,
  lookUp,
  offerAppTool,
  proposePlanChange,
}: Pick<GoalTutorInput, "links" | "lookUp" | "offerAppTool" | "proposePlanChange">) {
  return {
    [SEARCH_TOOL]: zoonkGateway.tools.parallelSearch({
      excerpts: { maxCharsPerResult: SEARCH_CHARACTERS_PER_RESULT },
      maxResults: SEARCH_RESULTS,
      mode: "agentic",
    }),
    ...createCardTools({ offerAppTool, proposePlanChange }),
    [LOOKUP_TOOL]: createLookUpTool({ links, lookUp }),
  };
}

/** Only a lookup has a deadline: the card tools wait for core, whose result the card shows. */
const TOOL_TIMEOUT = { tools: { lookUpMs: LOOKUP_DEADLINE_MS } };

/**
 * The first step searches when the question rests on facts that change (`shouldSearchFirst`);
 * the gateway runs the search and the model answers from it in the same step. After a round of
 * tools, the next step says what the card or button shows and answers the rest of the message,
 * and may still offer an app tool after a change; the last step only answers, so a message never
 * ends on tool calls. Every step sends the same tools and thinking, which a provider's cache keys
 * on, so a later step reads the whole request before it from the cache; except that once a step
 * looked up the learner's data, the steps after it can't search, so nothing it found goes into a
 * search query (a mitigation: the context and earlier answers still reach the model that searches).
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

    const lookedUp = steps.some((step) =>
      step.toolCalls.some((call) => call.toolName === LOOKUP_TOOL),
    );

    return lookedUp ? { activeTools: toolNames.filter((name) => name !== SEARCH_TOOL) } : {};
  };
}

/**
 * An exam goal's buddy also reads what only exams have (a cut-off, the notice's facts, mocks a plan
 * leaves to Plus, when the written tests are practiced), after the instructions every goal shares.
 * A goal's kind stays the same for a whole conversation, so its messages keep reading the same
 * prompt from the cache.
 */
const examSystemPrompt = `${systemPrompt}\n${examGoalPrompt}`;

/**
 * A question asked from a screen (a chapter, a lesson, a subject, a session's or practice's question
 * or a finished mock) also reads that screen's instructions, last. A thread stays on one screen, so its messages keep reading the same prompt
 * from the cache, and the buddy's own conversation never reads them.
 */
const SCREEN_PROMPTS = {
  answer: lessonScreenPrompt,
  chapter: chapterScreenPrompt,
  item: itemScreenPrompt,
  lesson: lessonScreenPrompt,
  mock: mockScreenPrompt,
  step: lessonScreenPrompt,
  subject: subjectScreenPrompt,
} satisfies Record<TutorScreenContext["scope"]["kind"], string>;

/**
 * The app's pages the buddy may link here, with the host's links, after the instructions every
 * goal shares: the same for every learner of a host, in its own conversation or on a screen, so it
 * stays in the cached start of every request.
 */
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
  const goalPrompt = contextSnapshot.goal.kind === "exam" ? examSystemPrompt : systemPrompt;
  const withPages = `${goalPrompt}\n${getPageGuide({ contextSnapshot, links })}`;
  const { screen } = contextSnapshot;

  return screen ? `${withPages}\n${SCREEN_PROMPTS[screen.scope.kind]}` : withPages;
}

/**
 * A language goal's doubts are about the language itself (grammar, words, how to say something),
 * which never changes, so its messages skip the classifier's half second before the first words;
 * the buddy can still search on its own.
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

  const tools = createTools(input);

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

/**
 * The buddy's answer without streaming, for evals: the same prompt, tools and steps, with the
 * eval's own stand-in for proposing plan changes.
 */
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

  // What the buddy searched for, so evals see when it looked a fact up.
  const searches = result.steps.flatMap((step) =>
    step.toolCalls
      .filter((call) => call.toolName === SEARCH_TOOL)
      .map((call) => JSON.stringify(call.input)),
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
 * The learner's buddy, as their tutor for one goal: it answers doubts about what they're learning,
 * explains their plan and, when they ask for a change, proposes it through `proposePlanChange`
 * (applied only after the learner's tap), then says what it proposed. Delivery adapters stream the
 * answer and save it; `provenance` resolves once it ends and rejects when the stream fails.
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
