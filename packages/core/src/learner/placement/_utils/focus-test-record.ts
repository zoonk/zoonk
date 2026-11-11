import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { lockLearner } from "@zoonk/db/learner-writes";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { parsePlanSettings } from "../../../plans/planner/plan-state";
import {
  FOCUS_TEST_DETAIL,
  type FocusTestRecord,
  NEW_FOCUS_TEST_RECORD,
  isFocusTestStarted,
  readFocusTestRecord,
} from "../focus-test-state";
import { isSameFocus } from "../focus-test-summary";

const oldResultSchema = z.object({ focusAreas: z.array(z.string()) });

/**
 * The standalone Focus test this one replaced kept its result in the activity ledger. A focus it
 * chose that the plan still has counts as the test's, so a later result may propose changing it.
 */
async function findOldTestFocus({
  goalId,
  tx,
}: {
  goalId: string;
  tx: TransactionClient;
}): Promise<string[] | null> {
  const event = await tx.learningEvent.findFirst({
    orderBy: { id: "desc" },
    select: { contentIds: true },
    where: { goalId, lessonKind: "focusTest" },
  });

  const content = isJsonObject(event?.contentIds) ? event.contentIds : {};
  const score = content.focusTestScore;
  const result = typeof score === "string" ? oldResultSchema.safeParse(JSON.parse(score)) : null;

  if (
    !result?.success ||
    result.data.focusAreas.length === 0 ||
    typeof content.planChangeId !== "string"
  ) {
    return null;
  }

  const plan = await tx.plan.findUnique({ select: { settings: true }, where: { goalId } });

  const latest = await tx.planChange.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    where: {
      payload: { array_contains: [{ kind: "focusAreas" }], path: ["operations"] },
      plan: { goalId },
      status: "applied",
    },
  });

  const { focusAreas } = parsePlanSettings(plan?.settings);

  if (latest?.id !== content.planChangeId) {
    return null;
  }

  return isSameFocus(focusAreas, result.data.focusAreas) ? focusAreas : null;
}

async function startRecord({
  goal,
  tx,
}: {
  goal: Pick<Goal, "createdAt" | "details" | "id">;
  tx: TransactionClient;
}): Promise<FocusTestRecord> {
  return {
    ...NEW_FOCUS_TEST_RECORD,
    focus: await findOldTestFocus({ goalId: goal.id, tx }),
    startedAt: isFocusTestStarted(goal) ? goal.createdAt.toISOString() : null,
  };
}

/**
 * Sets or restores the test's focus ownership in the plan's write. Takes the learner's lock,
 * which a plan's write may take after its own.
 */
export async function keepTestFocus({
  areas,
  goalId,
  tx,
  userId,
}: {
  areas: readonly string[];
  goalId: string;
  tx: TransactionClient;
  userId: string;
}): Promise<void> {
  await lockLearner(tx, { lockPlanIds: [], userId });

  await changeFocusTestRecord({
    change: (record) => ({ ...record, focus: [...areas] }),
    goalId,
    tx,
  });
}

async function writeTestRecord({
  goal,
  record,
  tx,
}: {
  goal: Pick<Goal, "details" | "id">;
  record: FocusTestRecord;
  tx: TransactionClient;
}): Promise<void> {
  const details = isJsonObject(goal.details) ? goal.details : {};

  await tx.goal.update({
    data: { details: { ...details, [FOCUS_TEST_DETAIL]: record } },
    where: { id: goal.id },
  });
}

export async function clearChangedTestFocus({
  areas,
  goal,
  tx,
}: {
  areas: readonly string[];
  goal: Pick<Goal, "id" | "kind">;
  tx: TransactionClient;
}): Promise<void> {
  if (goal.kind !== "exam") {
    return;
  }

  const current = await tx.goal.findUniqueOrThrow({ where: { id: goal.id } });
  const record = readFocusTestRecord(current);

  if (record?.focus && !isSameFocus(areas, record.focus)) {
    await writeTestRecord({ goal: current, record: { ...record, focus: null }, tx });
  }
}

/**
 * Call inside a transaction that holds the learner's lock (`writeLearnerChange`), so two writes
 * never start from the same record. Returns the record as kept, and the one before it.
 */
export async function changeFocusTestRecord({
  change,
  goalId,
  tx,
}: {
  change: (record: FocusTestRecord) => FocusTestRecord;
  goalId: string;
  tx: TransactionClient;
}): Promise<{ after: FocusTestRecord; before: FocusTestRecord }> {
  const goal = await tx.goal.findUniqueOrThrow({
    select: { createdAt: true, details: true, id: true },
    where: { id: goalId },
  });

  const stored = readFocusTestRecord(goal);
  const before = stored ?? (await startRecord({ goal, tx }));
  const after = change(before);

  if (!stored || !isDeepStrictEqual(stored, after)) {
    await writeTestRecord({ goal, record: after, tx });
  }

  return { after, before };
}
