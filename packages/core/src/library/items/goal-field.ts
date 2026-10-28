import "server-only";
import { createHash } from "node:crypto";
import { type WorkFieldParams, classifyWorkField } from "@zoonk/ai/tasks/v2/items/work-field";
import { type WorkField, isWorkField } from "@zoonk/ai/tasks/v2/items/work-fields";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { type GoalFieldInput, getGoalField, getGoalFieldInput } from "./item-field";

const FIELD_SOURCE_LENGTH = 16;

function hashFieldInput(input: GoalFieldInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, FIELD_SOURCE_LENGTH);
}

async function saveGoalField({
  field,
  goalId,
  source,
}: {
  field: WorkField | null;
  goalId: string;
  source: string;
}) {
  const goal = await prisma.goal.findUnique({ where: { id: goalId } });

  if (!goal) {
    return;
  }

  const planInputs = getGoalField(goal.details) !== field;

  const retry = await writeLearnerChange({ planInputs, userId: goal.userId }, async (tx) => {
    const current = await tx.goal.findUnique({ where: { id: goalId } });
    const input = getGoalFieldInput(current?.details);
    const details = isJsonObject(current?.details) ? current.details : {};

    if (
      !input ||
      hashFieldInput(input) !== source ||
      (details.fieldSource === source && details.field === field)
    ) {
      return unchanged(false);
    }

    if ((getGoalField(current?.details) !== field) !== planInputs) {
      return unchanged(true);
    }

    await tx.$executeRaw`
      UPDATE goals
      SET details = details || ${JSON.stringify({ field, fieldSource: source })}::jsonb
      WHERE id = ${goalId}::uuid
    `;

    return false;
  });

  if (retry) {
    await saveGoalField({ field, goalId, source });
  }
}

/** Internal workflow bridge: the public boundary must already have authorized the goal. */
export async function resolveGoalField({
  analytics,
  goalId,
}: {
  analytics?: WorkFieldParams["analytics"];
  goalId: string;
}): Promise<WorkField | null> {
  const goal = await prisma.goal.findUnique({
    select: { details: true, title: true },
    where: { id: goalId },
  });

  const input = getGoalFieldInput(goal?.details);

  if (!goal || !input) {
    return null;
  }

  const source = hashFieldInput(input);
  const details = isJsonObject(goal.details) ? goal.details : {};

  if (details.fieldSource === source) {
    return getGoalField(goal.details);
  }

  const { data } = await classifyWorkField({
    analytics: { ...analytics, contentScope: "personal", goalId },
    goal: goal.title,
    ...input,
  });

  const field = isWorkField(data.field) ? data.field : null;

  await saveGoalField({ field, goalId, source });

  return field;
}
