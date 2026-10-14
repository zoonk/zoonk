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

/**
 * What the judge reads: the buddy's words, the change it asked for, the app tools it offered and
 * what it searched for, if any.
 */
type GoalTutorOutput = {
  answer: string;
  /**
   * The answer's links as the app checks them before saving it (`createAnswerLinks`): `kept`, the
   * ones it was given; `removed`, any it wasn't (made up, outside the app), which the app turns
   * into words. Null when the answer has none.
   */
  links: { kept: string[]; removed: string[] } | null;
  /** What the buddy looked up, with what core answered (`found`, `notFound`); null when nothing. */
  lookUps: string | null;
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

/** What core answers each lookup with; a kind the case leaves out finds nothing. */
export type GoalTutorLookUpStandIn = Partial<Record<GoalTutorLookUp, GoalTutorLookUpResult>>;

type GoalTutorInput = Omit<
  GenerateGoalTutorAnswerParams,
  "links" | "lookUp" | "offerAppTool" | "proposePlanChange"
> & {
  /** What core answers each app tool with; a tool the case leaves out is unavailable. */
  appTools?: GoalTutorAppToolStandIn;
  /** What core answers each lookup with. */
  lookUps?: GoalTutorLookUpStandIn;
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
 * Stands in for core: a lookup finds what the case says, the change is "proposed" with the request as its summary (or "unchanged",
 * when the case says the plan already works that way), with what the case says core adds (parts
 * left out, the notice's official date, cautions, the effect), and an app tool is offered or not
 * as the case says, so the eval sees whether the buddy chose the right lever and how it talks
 * about it afterwards. Searches run for real.
 */
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

  // The web app's links, given and checked as the answers route gives and checks them.
  const { checkLinks, links } = createAnswerLinks(
    listGoalTutorPages({ selectedGoal: input.contextSnapshot.selectedGoal === true }),
  );

  // The buddy's tools keep one card per message (`createCardTools`): only calls that may show
  // one reach these stand-ins, so a feature turned away for the message's card isn't listed.
  const result = await generateGoalTutorAnswer({
    ...input,
    links,
    // What core finds for each kind, as the case says; a kind it leaves out finds nothing.
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
  // The whole answer, a proposal's round trip included; it streams, so the first words come sooner.
  latencyBudget: { p50: 8, p95: 15 },
  name: "Goal Tutor",
  testCases: TEST_CASES,
};
