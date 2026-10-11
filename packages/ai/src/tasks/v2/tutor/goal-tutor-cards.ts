import { tool } from "ai";
import { z } from "zod";
import {
  GOAL_TUTOR_APP_TOOLS,
  GOAL_TUTOR_APP_TOOLS_DESCRIPTION,
  type GoalTutorAppTool,
} from "./goal-tutor-tools";

const MAX_REQUEST_LENGTH = 500;
const MAX_TOPIC_LENGTH = 80;

/** When the plan ends before and after a change, and the lessons it adds or removes. */
export type GoalTutorPlanChangeEffect = {
  /** For topics the learner adds: they come before lessons of the plan's first phase. */
  addedTopicsBeforeBasics?: true;
  /** For topics the learner adds: when the first of their lessons is due with the change. */
  addedTopicsStart?: string;
  /**
   * For more or less time on some areas: when each one whose end moves has its last lesson with
   * the change, and now, and the lessons it gains (fewer when negative) when that's why it moves.
   */
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
  /** Some lessons added aren't written yet, so lessonsAdded is an estimate: say about how many. */
  lessonsAddedEstimated?: true;
  /** The lessons the change leaves out of the plan the learner sees, by title, as the card names them. */
  lessonsLeftOut?: string[];
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
export type ProposeGoalPlanChange = (request: string) => Promise<GoalTutorPlanChangeResult>;

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
export type OfferGoalAppTool = (input: GoalTutorAppToolRequest) => Promise<GoalTutorAppToolResult>;

/**
 * The step a call belongs to, as the conversation the model answered when it made it: every call
 * of one step shares it, and the next step's is longer by that step's own calls and results.
 */
function getStep(messages: readonly unknown[]): number {
  return messages.length;
}

/**
 * The buddy's two tools that put a card under its answer: a plan change's (Apply and Not now) or
 * one of the app's features. A message shows one card, the first one a call shows, except that a
 * plan change the learner asked for wins over a feature asked for in the same step, whatever
 * order the model calls them in: the feature gets `changeFirst` and waits for the next message.
 * Marcos asked for a speaking call and for SQL lessons in one message, and the call's card won
 * while his change waited. Calls run one after another, so a later one sees the card an earlier
 * one showed; neither rejects (core's errors come back as results), so the queue never breaks.
 * A step's calls are all known before any of them runs, which is when a plan change says it's
 * coming (`onInputAvailable`).
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
