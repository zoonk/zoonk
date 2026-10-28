import { type Task } from "@/lib/types";
import {
  type GenerateGoalTutorAnswerParams,
  generateGoalTutorAnswer,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor";
import {
  type GoalTutorAppToolResult,
  type GoalTutorPlanChangeResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-cards";
import {
  type GoalTutorLookUp,
  type GoalTutorLookUpResult,
} from "@zoonk/ai/tasks/v2/tutor/goal-tutor-lookup";
import { listGoalTutorPages } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-pages";
import { type GoalTutorAppTool } from "@zoonk/ai/tasks/v2/tutor/goal-tutor-tools";
import { createAnswerLinks } from "@zoonk/player/tutor/app-links";
import { TEST_CASES } from "./test-cases";

type GoalTutorOutput = {
  answer: string;
  links: { kept: string[]; removed: string[] } | null;
  lookUps: string | null;
  offeredTools: string | null;
  proposedChange: string | null;
  searches: string | null;
  toolResults: string | null;
};

type ProposedResult = Extract<GoalTutorPlanChangeResult, { status: "proposed" }>;

export type GoalTutorPlanChangeStandIn =
  | "unchanged"
  | {
      cautions?: ProposedResult["cautions"];
      changes?: string;
      effect?: ProposedResult["effect"];
      leftOut?: string[];
      officialExamDate?: { date: string; source: string | null };
    };

type OfferedStandIn = Extract<GoalTutorAppToolResult, { status: "offered" }>["offered"] & {
  plusRequired?: true;
};

export type GoalTutorAppToolStandIn = Partial<
  Record<
    GoalTutorAppTool,
    OfferedStandIn | Extract<GoalTutorAppToolResult, { status: "unavailable" }>["reason"]
  >
>;

/** A lookup kind omitted by the case finds nothing. */
export type GoalTutorLookUpStandIn = Partial<Record<GoalTutorLookUp, GoalTutorLookUpResult>>;

type GoalTutorInput = Omit<
  GenerateGoalTutorAnswerParams,
  "links" | "lookUp" | "offerAppTool" | "proposePlanChange"
> & {
  /** An app tool omitted by the case is unavailable. */
  appTools?: GoalTutorAppToolStandIn;
  lookUps?: GoalTutorLookUpStandIn;
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

async function generate({
  appTools,
  lookUps,
  planChange,
  ...input
}: GoalTutorInput & { model: string }) {
  const requests: string[] = [];
  const offers: string[] = [];
  const looked: string[] = [];
  const results: unknown[] = [];

  const { checkLinks, links } = createAnswerLinks(
    listGoalTutorPages({ selectedGoal: input.contextSnapshot.selectedGoal === true }),
  );

  const result = await generateGoalTutorAnswer({
    ...input,
    links,
    lookUp: ({ area, query, what }) => {
      const answer = lookUps?.[what] ?? { status: "notFound" as const, what };
      const asked = [area, query].filter(Boolean).join(", ");
      looked.push(`${what}${asked ? ` (${asked})` : ""}: ${answer.status}`);
      results.push(answer);
      return Promise.resolve(answer);
    },
    offerAppTool: ({ area, goal, tool, topic }) => {
      const answer = standInAppTool({ appTools, area, tool });
      const asked = [area, goal, topic].filter(Boolean).join(", ");
      const locked = answer.status === "offered" && answer.plusRequired ? " (locked: Plus)" : "";
      offers.push(`${tool}${asked ? ` (${asked})` : ""}: ${answer.status}${locked}`);
      results.push(answer);
      return Promise.resolve(answer);
    },
    proposePlanChange: (request) => {
      requests.push(request);

      const answer: GoalTutorPlanChangeResult =
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

      results.push(answer);
      return Promise.resolve(answer);
    },
  });

  const checked = checkLinks(result.data.answer);
  const hasLinks = checked.kept.length > 0 || checked.removed.length > 0;

  return {
    data: {
      answer: result.data.answer,
      links: hasLinks ? { kept: checked.kept, removed: checked.removed } : null,
      lookUps: looked.join(" | ") || null,
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
  latencyBudget: { p50: 8, p95: 15 },
  name: "Goal Tutor",
  testCases: TEST_CASES,
};
