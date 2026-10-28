import { tool } from "ai";
import { z } from "zod";
import {
  GOAL_TUTOR_APP_TOOLS,
  GOAL_TUTOR_APP_TOOLS_DESCRIPTION,
  type GoalTutorAppTool,
} from "./goal-tutor-tools";

const MAX_REQUEST_LENGTH = 500;
const MAX_TOPIC_LENGTH = 80;

export type GoalTutorPlanChangeEffect = {
  /** For topics the learner adds: they come before lessons of the plan's first phase. */
  addedTopicsBeforeBasics?: true;
  /** For added topics: when their first lesson is due with the change. */
  addedTopicsStart?: string;
  /** For more or less time on some areas; lessons gained are negative when it loses some. */
  areaEnds?: {
    area: string;
    lastLessonNow: string;
    lastLessonWithChange: string;
    lessonsGained?: number;
  }[];
  /** For a focus: when each focused area's first lesson is due with the change, and now. */
  areaStarts?: {
    area: string;
    firstLessonNow: string | null;
    firstLessonWithChange: string | null;
  }[];
  endDateAfter: string | null;
  endDateBefore: string | null;
  lessonsAdded: number;
  /**
   * Some lessons added aren't written yet, so `lessonsAdded` is an estimate: say about how many.
   */
  lessonsAddedEstimated?: true;
  lessonsLeftOut?: string[];
  lessonsRemoved: number;
  topicsAdded?: { area: string; topics: string[] }[];
  topicsLeftOut?: { area: string; topics: string[] }[];
} | null;

/** The change itself only happens when the learner taps Apply. */
export type GoalTutorPlanChangeResult =
  | {
      effect: GoalTutorPlanChangeEffect;
      /** What the change costs, to say before the learner applies it. */
      cautions: (
        | { area: string; kind: "leavesOutExamSubject"; questions: number }
        | { endDate: string; kind: "endsBeforeDate"; targetDate: string }
      )[];
      /** To answer in words. */
      leftOut: string[];
      /** Set when the change moves the exam off the notice's day. */
      officialExamDate: { date: string; source: string | null } | null;
      /** As the card says it: the plan changes only this way. */
      changes: string;
      status: "proposed";
    }
  | { leftOut?: string[]; reason: string; status: "notPossible" }
  /** The plan already works that way, or the change wouldn't move anything in it. */
  | { leftOut: string[]; status: "unchanged" }
  | { status: "notReady" | "notUnderstood" };

export type ProposeGoalPlanChange = (request: string) => Promise<GoalTutorPlanChangeResult>;

export type GoalTutorAppToolResult =
  | {
      /**
       * `callTimeUsed`: call time is used until tomorrow, next month or, for a guest, an account.
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
        /** Besides the full exam; empty when none can be on its own. */
        subjects?: string[];
        /** For Plus: the learner already has it, so its page manages it. */
        subscribed?: boolean;
        unit?: string;
        words?: string[];
      };
      /** The card shows it locked, with what Plus unlocks. */
      plusRequired?: true;
      status: "offered";
      tool: GoalTutorAppTool;
    }
  | {
      reason:
        | "changeFirst"
        | "everythingFits"
        | "noMistakes"
        | "noMock"
        | "notExam"
        | "notLanguage"
        | "notWritten"
        | "nothingDue"
        | "nothingToSkip"
        | "onePerMessage"
        | "testFailedToday"
        | "unavailable";
      status: "unavailable";
      tool: GoalTutorAppTool;
    };

export type GoalTutorAppToolRequest = {
  /** For a chapter's test: the plan area whose next chapter to test. */
  area: string | null;
  /** For a new goal: what the learner wants, in their words, to fill in. */
  goal: string | null;
  tool: GoalTutorAppTool;
  /** For a new goal: its subject in a few words, to look for a course in the catalog. */
  topic: string | null;
};

export type OfferGoalAppTool = (input: GoalTutorAppToolRequest) => Promise<GoalTutorAppToolResult>;

/**
 * Every call of one step shares the conversation it answered, and the next step's is longer by
 * that step's own calls and results.
 */
function getStep(messages: readonly unknown[]): number {
  return messages.length;
}

/**
 * A message shows one card, the first a call shows, except that a plan change asked for in the
 * same step wins over a feature whatever order the model calls them in (`changeFirst`). Calls run
 * in order and never reject, so the queue never breaks; a step's calls are all known before any
 * runs (`onInputAvailable`).
 */
export function createCardTools({
  offerAppTool,
  proposePlanChange,
}: {
  offerAppTool: OfferGoalAppTool;
  proposePlanChange: ProposeGoalPlanChange;
}) {
  const card = { shown: false };
  const queue: { last: Promise<unknown> } = { last: Promise.resolve() };

  // The plan changes a step asked for that haven't run yet: their call ids, with the step.
  const changesAhead = new Map<string, number>();

  const inTurn = <T>(call: () => Promise<T>): Promise<T> => {
    const result = queue.last.then(call);
    queue.last = result;
    return result;
  };

  const offer = async ({
    request,
    step,
  }: {
    request: GoalTutorAppToolRequest;
    step: number;
  }): Promise<GoalTutorAppToolResult> => {
    if (card.shown) {
      return { reason: "onePerMessage", status: "unavailable", tool: request.tool };
    }

    if ([...changesAhead.values()].includes(step)) {
      return { reason: "changeFirst", status: "unavailable", tool: request.tool };
    }

    const result = await offerAppTool(request);
    card.shown = result.status === "offered";
    return result;
  };

  const propose = async ({
    request,
    toolCallId,
  }: {
    request: string;
    toolCallId: string;
  }): Promise<GoalTutorPlanChangeResult> => {
    changesAhead.delete(toolCallId);

    if (card.shown) {
      return { reason: "onePerMessage", status: "notPossible" };
    }

    const result = await proposePlanChange(request);
    card.shown = result.status === "proposed";
    return result;
  };

  return {
    offerAppTool: tool({
      description: GOAL_TUTOR_APP_TOOLS_DESCRIPTION,
      execute: (request, { messages }) => inTurn(() => offer({ request, step: getStep(messages) })),
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
      execute: ({ request }, { toolCallId }) => inTurn(() => propose({ request, toolCallId })),
      inputSchema: z.object({
        request: z
          .string()
          .max(MAX_REQUEST_LENGTH)
          .describe(
            "The change the learner asked for, as one self-contained sentence in their language, with every detail the conversation gave",
          ),
      }),
      onInputAvailable: ({ messages, toolCallId }) => {
        changesAhead.set(toolCallId, getStep(messages));
      },
    }),
  };
}
