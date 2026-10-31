import "server-only";
import { randomUUID } from "node:crypto";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist, claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../../entitlements/contract";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import {
  type PlacementQuickFormat,
  getPlacementQuickFormat,
} from "../../learner/placement/placement-quick-format";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import {
  type AnytimeMockPick,
  listMissingRecordings,
  loadAnytimeMockSetup,
  resolveAnytimeOption,
} from "./_utils/anytime-mock-setup";
import { planMockWrites } from "./_utils/mock-writes";
import { type AnytimeMockChoice } from "./mock-contract";
import { type MockFormatShortfall } from "./mock-shortfall";

/** On `start`, the caller must dispatch generation; `preparing` requires polling until the skill map exists. */
export type MockQuestionsRequest =
  | { status: "preparing" }
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      listening: boolean;
      quickFormat: PlacementQuickFormat;
      status: "start";
      writes: MockFormatShortfall[];
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "invalidOption" | "notExam" | "notFound" | "plusRequired" | "unauthorized" };

function claimMockQuestions(pick: AnytimeMockPick): Promise<UsageDecision> {
  return pick.purpose === "placement"
    ? claimAssist()
    : claimUsage({ kind: "mockQuestions", targetId: randomUUID() });
}

export async function requestMockQuestions({
  goalId,
  input,
}: {
  goalId: string;
  input: AnytimeMockChoice;
}): Promise<MockQuestionsRequest> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  const [access, setup] = await Promise.all([
    getAnytimeMockAccess(goal),
    loadAnytimeMockSetup(goal),
  ]);

  if (access !== "open") {
    return { status: access };
  }

  const pick = resolveAnytimeOption({ choice: input, setup });

  if (!pick) {
    return { status: "invalidOption" };
  }

  const writes = await planMockWrites({ goal, pick, setup, userId });

  if (!writes) {
    return { status: "preparing" };
  }

  const listening = listMissingRecordings({ pick, setup }).length > 0;

  if (writes.length === 0 && !listening) {
    return { status: "ready" };
  }

  const decision = await claimMockQuestions(pick);

  if (decision.status === "unauthorized") {
    return decision;
  }

  if (decision.status === "limitReached" && pick.purpose === "practice") {
    return { status: "ready" };
  }

  if (decision.status !== "allowed") {
    return { decision, status: "refused" };
  }

  return {
    analytics: { distinctId: userId, goalId, platform: await getRequestPlatform() },
    listening,
    quickFormat: getPlacementQuickFormat(setup.structure),
    status: "start",
    writes,
  };
}
