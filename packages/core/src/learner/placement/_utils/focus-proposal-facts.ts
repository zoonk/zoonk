import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { parsePlanChangePayload } from "../../../plans/_utils/plan-change-payload";
import { getAnsweredQuestions } from "../../../view-models/onboarding/onboarding-steps";
import { FOCUS_TEST_SOURCE } from "../focus-test-contract";
import { type FocusTestRecord } from "../focus-test-state";
import { isSameFocus } from "../focus-test-summary";
import { type FocusPlan } from "../focus-test-view";
import { type TestSetup } from "./focus-test-setup";

type FocusFacts = Omit<FocusPlan, "proposal"> & { waitingId: string | null; due: string[] | null };

/** Before the daily time is saved, saving it sets the focus; from then on the test proposes. */
function isTimeSaved(goal: Pick<Goal, "details" | "planRevealedAt">): boolean {
  const details = isJsonObject(goal.details) ? goal.details : {};
  return goal.planRevealedAt !== null || getAnsweredQuestions(details).includes("schedule");
}

export function getProposedAreas(payload: unknown): string[] {
  return parsePlanChangePayload(payload).operations.flatMap((operation) =>
    operation.kind === "focusAreas" ? operation.areas : [],
  );
}

export async function loadFocusOwnership({
  focusAreas,
  planId,
  record,
  tx,
}: {
  focusAreas: readonly string[];
  planId: string;
  record: FocusTestRecord | null;
  tx: TransactionClient;
}): Promise<{ handPicked: boolean; lastChangedAt: Date | null }> {
  if (focusAreas.length === 0) {
    return { handPicked: false, lastChangedAt: null };
  }

  const latest = await tx.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { createdAt: true, payload: true },
    where: {
      payload: { array_contains: [{ kind: "focusAreas" }], path: ["operations"] },
      planId,
      status: "applied",
    },
  });

  const source = parsePlanChangePayload(latest?.payload).source;

  const offered =
    latest &&
    [FOCUS_TEST_SOURCE, "mock", "preparation"].includes(source) &&
    isSameFocus(focusAreas, getProposedAreas(latest.payload));

  const owned = isSameFocus(focusAreas, record?.focus ?? []) || offered;

  return { handPicked: focusAreas.length > 0 && !owned, lastChangedAt: latest?.createdAt ?? null };
}

/**
 * The test proposes once the daily time is saved and doesn't cover everything, only while the
 * plan's focus is none or system-owned, never what the plan already follows, and
 * never a suggestion waiting or dismissed: a replaced one may come back.
 */
export async function loadFocusProposalFacts({
  asks,
  goal,
  plan,
  record,
  suggested,
  tx,
}: {
  asks: boolean;
  goal: Pick<Goal, "details" | "planRevealedAt">;
  plan: TestSetup["plan"];
  record: FocusTestRecord | null;
  suggested: string[];
  tx: TransactionClient;
}): Promise<FocusFacts> {
  const { coveredShare, focusAreas, id } = plan;
  const timeSaved = isTimeSaved(goal);
  const timeShort = coveredShare !== null && coveredShare < 1;
  const proposes = asks && timeSaved && timeShort;

  const { handPicked } = await loadFocusOwnership({ focusAreas, planId: id, record, tx });

  const changes = proposes
    ? await tx.planChange.findMany({
        select: { id: true, payload: true, status: true },
        where: { payload: { equals: FOCUS_TEST_SOURCE, path: ["source"] }, planId: id },
      })
    : [];

  const waiting = changes.find((change) => change.status === "proposed");

  const statuses = new Set(
    changes
      .filter((change) => isSameFocus(getProposedAreas(change.payload), suggested))
      .map((change) => change.status),
  );

  const declined = statuses.has("declined") || statuses.has("undone");

  const due =
    proposes &&
    !declined &&
    !waiting &&
    !statuses.has("proposed") &&
    !isSameFocus(focusAreas, suggested) &&
    !handPicked;

  return {
    declined,
    due: due ? suggested : null,
    focusAreas,
    handPicked,
    timeSaved,
    timeShort,
    waitingId: waiting?.id ?? null,
  };
}
