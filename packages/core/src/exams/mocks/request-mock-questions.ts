import "server-only";
import { randomUUID } from "node:crypto";
import { getRequestPlatform } from "../../analytics/request-platform";
import { type AnalyticsPlatform } from "../../analytics/shared-properties";
import { claimAssist, claimUsage } from "../../entitlements/claim-usage";
import { type RefusedUsage, type UsageDecision } from "../../entitlements/contract";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
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

/**
 * `ready`: the mock can start now: the bank holds its questions, or the learner's fair use for new
 * ones is used for now, so it asks what the bank has (start it with `acceptFewer`). `preparing`:
 * the goal's skill map is still being drawn (a goal in onboarding), so there's nothing to write for
 * yet: ask again soon. `start`: the caller starts a run writing each of the exam's formats the bank
 * is short of (`writes`: the exam's one-pick format in `quickFormat`, the others with the item
 * writer) and the recordings its listening sections lack (`listening`), shared by every later
 * learner of the exam,
 * whose analytics name the learner, their goal and the client that asked. `refused`: the
 * learner's AI help allowance doesn't cover it now.
 */
export type MockQuestionsRequest =
  | { status: "preparing" }
  | { status: "ready" }
  | {
      analytics: { distinctId: string; goalId: string; platform: AnalyticsPlatform | null };
      /** The mock's listening sections lack recordings: the run writes and voices them too. */
      listening: boolean;
      quickFormat: PlacementQuickFormat;
      status: "start";
      writes: MockFormatShortfall[];
    }
  | { decision: RefusedUsage; status: "refused" }
  | { status: "invalidOption" | "notExam" | "notFound" | "plusRequired" | "unauthorized" };

/**
 * Claims writing a mock's questions: a diagnostic mock's few as small AI help; any other mock's
 * from the plan's fair use for mocks (see `limits.ts`), which a mock taken any time, as often as
 * the learner wants, never waits on.
 */
function claimMockQuestions(pick: AnytimeMockPick): Promise<UsageDecision> {
  return pick.purpose === "placement"
    ? claimAssist()
    : claimUsage({ kind: "mockQuestions", targetId: randomUUID() });
}

/**
 * Decides what asking for a mock's questions does, when the learner taps to start one: when the
 * shared bank holds fewer questions they haven't answered than the mock asks, the mock's skills
 * that are short of their share get some written (in the exam's own format, shared with every
 * later learner of the exam), claimed first; for a diagnostic mock, only the topics its questions
 * are spread over that have none. Nothing is written when the bank already holds them, or past
 * the learner's fair use for new questions: the mock asks ones they answered before instead.
 */
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
    getAnytimeMockAccess({ goal, timeZone: getAnswerTimeZone({ goal }) }),
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

  // Past fair use, the mock starts at once with questions the learner answered before.
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
