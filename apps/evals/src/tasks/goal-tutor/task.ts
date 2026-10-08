import { type Task } from "@/lib/types";
import {
  type GenerateGoalTutorAnswerParams,
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
  generateGoalTutorAnswer,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import { type GoalTutorAppTool } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import { TEST_CASES } from "./test-cases";

/**
 * What the judge reads: the buddy's words, the change it asked for, the app tools it offered and
 * what it searched for, if any.
 */
type GoalTutorOutput = {
  answer: string;
  offeredTools: string | null;
  proposedChange: string | null;
  searches: string | null;
  /** What the tools answered (a change's effect and cautions, what an app tool opens). */
  toolResults: string | null;
};

type ProposedResult = Extract<GoalTutorPlanChangeResult, { status: "proposed" }>;

/** What core answers a proposal with, beyond the change itself. */
export type GoalTutorPlanChangeStandIn =
  | "unchanged"
  | {
      /** What the change costs, as core finds it. */
      cautions?: ProposedResult["cautions"];
      /** What the change does, as core says it from its operations; the request when absent. */
      changes?: string;
      /** What the change does, as core computes it. */
      effect?: ProposedResult["effect"];
      /** Parts of the request no change covers. */
      leftOut?: string[];
      /** The exam day the notice sets, which the change moves the exam off. */
      officialExamDate?: { date: string; source: string | null };
    };

type OfferedStandIn = Extract<GoalTutorAppToolResult, { status: "offered" }>["offered"] & {
  /** The learner's plan doesn't include it: the card shows it locked. */
  plusRequired?: true;
};

/**
 * What core answers a feature with: what its card opens when offered (locked with
 * `plusRequired`), or why it can't help now.
 */
export type GoalTutorAppToolStandIn = Partial<
  Record<
    GoalTutorAppTool,
    OfferedStandIn | Extract<GoalTutorAppToolResult, { status: "unavailable" }>["reason"]
  >
>;

type GoalTutorInput = Omit<GenerateGoalTutorAnswerParams, "offerAppTool" | "proposePlanChange"> & {
  /** What core answers each app tool with; a tool the case leaves out is unavailable. */
  appTools?: GoalTutorAppToolStandIn;
  /** What core answers the change with: proposed (the default), or unchanged for a no-op. */
  planChange?: GoalTutorPlanChangeStandIn;
};

const NO_EFFECT = { endDateAfter: null, endDateBefore: null, lessonsAdded: 0, lessonsRemoved: 0 };

function standInAppTool({
  appTools,
  area,
  tool,
}: {
  appTools: GoalTutorAppToolStandIn | undefined;
  area: string | null;
  tool: GoalTutorAppTool;
}): GoalTutorAppToolResult {
  const answer = appTools?.[tool];

  if (answer === undefined || typeof answer === "string") {
    return { reason: answer ?? "unavailable", status: "unavailable", tool };
  }

  const { plusRequired, ...details } = answer;
  const offered = area ? { ...details, chapter: details.chapter ?? area } : details;

  return plusRequired
    ? { offered, plusRequired, status: "offered", tool }
    : { offered, status: "offered", tool };
}

/**
 * Stands in for core: the change is "proposed" with the request as its summary (or "unchanged",
 * when the case says the plan already works that way), with what the case says core adds (parts
 * left out, the notice's official date, cautions, the effect), and an app tool is offered or not
 * as the case says, so the eval sees whether the buddy chose the right lever and how it talks
 * about it afterwards. Searches run for real.
 */
async function generate({ appTools, planChange, ...input }: GoalTutorInput & { model: string }) {
  const requests: string[] = [];
  const offers: string[] = [];
  const results: unknown[] = [];

  // One card per message, as the API keeps it: a plan change's or a feature's, the first one.
  const hasCard = () =>
    results.some(
      (shown) =>
        typeof shown === "object" &&
        shown !== null &&
        "status" in shown &&
        (shown.status === "proposed" || shown.status === "offered"),
    );

  const result = await generateGoalTutorAnswer({
    ...input,
    offerAppTool: ({ area, goal, tool, topic }) => {
      const answer: GoalTutorAppToolResult = hasCard()
        ? { reason: "onePerMessage", status: "unavailable", tool }
        : standInAppTool({ appTools, area, tool });

      const asked = [area, goal, topic].filter(Boolean).join(", ");
      const locked = answer.status === "offered" && answer.plusRequired ? " (locked: Plus)" : "";
      offers.push(`${tool}${asked ? ` (${asked})` : ""}: ${answer.status}${locked}`);
      results.push(answer);
      return Promise.resolve(answer);
    },
    proposePlanChange: (request) => {
      requests.push(request);

      const proposed = (): GoalTutorPlanChangeResult =>
        planChange === "unchanged"
          ? { leftOut: [], status: "unchanged" }
          : {
              cautions: planChange?.cautions ?? [],
              changes: planChange?.changes ?? request,
              effect: planChange?.effect ?? NO_EFFECT,
              leftOut: planChange?.leftOut ?? [],
              officialExamDate: planChange?.officialExamDate ?? null,
              status: "proposed",
            };

      const answer: GoalTutorPlanChangeResult = hasCard()
        ? { reason: "onePerMessage", status: "notPossible" }
        : proposed();

      results.push(answer);
      return Promise.resolve(answer);
    },
  });

  return {
    data: {
      answer: result.data.answer,
      offeredTools: offers.join(" | ") || null,
      proposedChange: requests.join(" | ") || null,
      searches: result.data.searches.join(" | ") || null,
      toolResults: results.length > 0 ? JSON.stringify(results) : null,
    },
    systemPrompt: result.systemPrompt,
    usage: result.usage,
    userPrompt: result.userPrompt,
  };
}

export const goalTutorTask: Task<GoalTutorInput, GoalTutorOutput> = {
  description:
    "The learner's buddy as their tutor for a goal: answer doubts, explain the plan, and propose plan changes asked for in plain words",
  generate,
  id: "goal-tutor",
  // The whole answer, a proposal's round trip included; it streams, so the first words come sooner.
  latencyBudget: { p50: 8, p95: 15 },
  name: "Goal Tutor",
  testCases: TEST_CASES,
};
