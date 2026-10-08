import "server-only";
import { generateText, isStepCount, streamText, tool } from "ai";
import { z } from "zod";
import { zoonkGateway } from "../../../gateway";
import { type AiGenerationContext } from "../../../provenance/ai-generation-event";
import { runTaskGeneration, startTaskGeneration } from "../../../provenance/run-task-generation";
import { type TaskProvenance } from "../../../provenance/task-provenance";
import { type Reasoning, buildProviderOptions } from "../../../provider-options";
import { type LessonQuestionPriorTurn } from "../../lessons/lesson-question";
import { type PlanScopeContext } from "../../lessons/lesson-question-context";
import { createGoalTutorMessages, serializeGoalTutorMessages } from "./goal-tutor-messages";
import { shouldSearchFirst } from "./goal-tutor-search";
import {
  GOAL_TUTOR_APP_TOOLS,
  GOAL_TUTOR_APP_TOOLS_DESCRIPTION,
  type GoalTutorAppTool,
} from "./goal-tutor-tools";
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
 * A round of tools (a plan change, an app tool), the answer that says it, and room for one more
 * round when the model offers an app tool after the change: at most three steps. A search runs
 * inside a step, on the gateway.
 */
const MAX_STEPS = 3;

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
const SEARCH_RESULTS = 5;
const SEARCH_CHARACTERS_PER_RESULT = 1500;
const MAX_REQUEST_LENGTH = 500;
const MAX_TOPIC_LENGTH = 80;
const EMPTY_ANSWER_MESSAGE = "AI provider returned an empty goal tutor answer";

/** When the plan ends before and after a change, and the lessons it adds or removes. */
export type GoalTutorPlanChangeEffect = {
  /** For a focus: when each focused area's first lesson is due with the change, and now. */
  areaStarts?: {
    area: string;
    firstLessonNow: string | null;
    firstLessonWithChange: string | null;
  }[];
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  lessonsRemoved: number;
  /** The exam's notice topics the change brings into the plan, by area. */
  topicsAdded?: { area: string; topics: string[] }[];
  /** The exam's notice topics the change leaves out of the plan, by area. */
  topicsLeftOut?: { area: string; topics: string[] }[];
} | null;

/**
 * What asking for a plan change did, as the model reads it. The change itself only happens when
 * the learner taps Apply.
 */
export type GoalTutorPlanChangeResult =
  | {
      effect: GoalTutorPlanChangeEffect;
      /**
       * What the change costs, to say before the learner applies it: an exam subject with
       * questions left out, or a plan that would end weeks before its date.
       */
      cautions: (
        | { area: string; kind: "leavesOutExamSubject"; questions: number }
        | { endDate: string; kind: "endsBeforeDate"; targetDate: string }
      )[];
      /** Parts of the request no change covers, to answer in words. */
      leftOut: string[];
      /** The exam day the notice sets, when the change moves the exam off it; null otherwise. */
      officialExamDate: { date: string; source: string | null } | null;
      /** What the change does, as the card says it: the plan changes only this way. */
      changes: string;
      status: "proposed";
    }
  | { leftOut?: string[]; reason: string; status: "notPossible" }
  /** The plan already works that way, or the change wouldn't move anything in it. */
  | { leftOut: string[]; status: "unchanged" }
  | { status: "notReady" | "notUnderstood" };

/** Asks core for the change, as a proposal waiting for the learner's tap. */
type ProposeGoalPlanChange = (request: string) => Promise<GoalTutorPlanChangeResult>;

/**
 * What offering one of the app's features did, as the model reads it: the card the learner sees
 * under the answer (with what it opens, locked when their plan doesn't include it), or why the
 * feature can't help now.
 */
export type GoalTutorAppToolResult =
  | {
      /**
       * What the card opens: the chapter or unit, the lessons a passed test skips, the call
       * lengths that fit what's left of the learner's call time (or, `callTimeUsed`, that it's
       * used until tomorrow, next month or, for a guest, an account), the subjects a mock can
       * also be on its own, the catalog course a new goal's card shows, the written test and when
       * the plan practices it, the notebook's open mistakes, the words to say again.
       */
      offered: {
        cadence?: "biweekly" | "finalWeeks" | "weekly";
        callTimeUsed?: "day" | "month" | "total";
        chapter?: string;
        course?: string;
        lessonsLeft?: number;
        minutes?: number[];
        mistakes?: number;
        subject?: string;
        /** The subjects a mock can be on alone, besides the full exam; empty when none can. */
        subjects?: string[];
        /** For Plus: the learner already has it, so its page manages it. */
        subscribed?: boolean;
        unit?: string;
        words?: string[];
      };
      /** Their plan doesn't include it: the card shows it locked, with what Plus unlocks. */
      plusRequired?: true;
      status: "offered";
      tool: GoalTutorAppTool;
    }
  | {
      reason:
        | "everythingFits"
        | "noMistakes"
        | "noMock"
        | "notExam"
        | "notLanguage"
        | "notWritten"
        | "nothingDue"
        | "nothingToSkip"
        | "onePerMessage"
        | "unavailable";
      status: "unavailable";
      tool: GoalTutorAppTool;
    };

/** What the model asks for: the feature, and what some features need to open. */
export type GoalTutorAppToolRequest = {
  /** For a chapter's test: the plan area whose next chapter to test. */
  area: string | null;
  /** For a new goal: what the learner wants, in their words, to fill in. */
  goal: string | null;
  tool: GoalTutorAppTool;
  /** For a new goal: its subject in a few words, to look for a course in the catalog. */
  topic: string | null;
};

/** Asks core to offer one of the app's features under the answer. */
type OfferGoalAppTool = (input: GoalTutorAppToolRequest) => Promise<GoalTutorAppToolResult>;

type GoalTutorInput = {
  analytics?: AiGenerationContext;
  contextSnapshot: PlanScopeContext;
  /** Facts the learner shared before (their goals, routine, how they learn), when memory is on. */
  learnerMemory?: readonly string[];
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
  offerAppTool,
  proposePlanChange,
}: Pick<GoalTutorInput, "offerAppTool" | "proposePlanChange">) {
  return {
    [SEARCH_TOOL]: zoonkGateway.tools.parallelSearch({
      excerpts: { maxCharsPerResult: SEARCH_CHARACTERS_PER_RESULT },
      maxResults: SEARCH_RESULTS,
      mode: "agentic",
    }),
    offerAppTool: tool({
      description: GOAL_TUTOR_APP_TOOLS_DESCRIPTION,
      execute: (request) => offerAppTool(request),
      inputSchema: z.object({
        area: z
          .string()
          .nullable()
          .describe(
            "For chapterTest: the plan area whose next chapter to test, exactly as setup.areas names it; null for the plan's next chapter or another tool",
          ),
        goal: z
          .string()
          .max(MAX_REQUEST_LENGTH)
          .nullable()
          .describe(
            "For startGoal: the new goal alone, in the learner's own words and language, as they'd type it to start it (without their current goal's name); null for another tool",
          ),
        tool: z.enum(GOAL_TUTOR_APP_TOOLS),
        topic: z
          .string()
          .max(MAX_TOPIC_LENGTH)
          .nullable()
          .describe(
            'For startGoal: the subject in one to three words of their language, as a course would be titled ("Violão", "Inglês", "Python"); null for another tool',
          ),
      }),
    }),
    proposePlanChange: tool({
      description:
        "Proposes a change to the learner's study plan. The app shows it as a card with Apply and Not now; nothing changes until the learner taps Apply.",
      execute: ({ request }) => proposePlanChange(request),
      inputSchema: z.object({
        request: z
          .string()
          .max(MAX_REQUEST_LENGTH)
          .describe(
            "The change the learner asked for, as one self-contained sentence in their language, with every detail the conversation gave",
          ),
      }),
    }),
  };
}

/**
 * The first step searches when the question rests on facts that change (`shouldSearchFirst`);
 * the gateway runs the search and the model answers from it in the same step. After a round of
 * tools, the next step says what the card or button shows and answers the rest of the message,
 * and may still offer an app tool after a change; a third step only answers, so a message never
 * ends on tool calls. Every step sends the same tools and thinking, which a provider's cache keys
 * on, so a later step reads the whole request before it from the cache.
 */
function createPrepareStep(searchFirst: Promise<boolean>) {
  return async ({ stepNumber }: { stepNumber: number }) => {
    if (stepNumber === MAX_STEPS - 1) {
      return { toolChoice: "none" as const };
    }

    if (stepNumber === 0 && (await searchFirst)) {
      return { toolChoice: { toolName: SEARCH_TOOL, type: "tool" } as const };
    }

    return {};
  };
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

  return {
    instructions: systemPrompt,
    messages: createGoalTutorMessages(input),
    model,
    prepareStep: createPrepareStep(searchFirst),
    providerOptions: buildProviderOptions({ fallbackModels, model, useFallback }),
    reasoning,
    stopWhen: isStepCount(MAX_STEPS),
    tools: createTools(input),
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
    systemPrompt,
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
    systemPrompt,
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

  const run = startTaskGeneration({ analytics: context, systemPrompt, task: GOAL_TUTOR_TASK });

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
