import "server-only";
import { createHash } from "node:crypto";
import { type WorkFieldParams, classifyWorkField } from "@zoonk/ai/tasks/v2/items/work-field";
import { type WorkField, isWorkField } from "@zoonk/ai/tasks/v2/items/work-fields";
import { prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type GoalFieldInput, getGoalField, getGoalFieldInput } from "./item-field";

/** A short fingerprint is enough to tell one set of role answers from another. */
const FIELD_SOURCE_LENGTH = 16;

/** Changes when the role answers change, so an edited role is sorted again. */
function hashFieldInput(input: GoalFieldInput): string {
  return createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, FIELD_SOURCE_LENGTH);
}

/**
 * Stores the field next to the goal's other understood details in one statement that only adds
 * two keys, so an onboarding answer saved at the same moment keeps its own keys.
 */
async function saveGoalField({
  field,
  goalId,
  source,
}: {
  field: WorkField | null;
  goalId: string;
  source: string;
}) {
  await prisma.$executeRaw`
    UPDATE goals
    SET details = details || ${JSON.stringify({ field, fieldSource: source })}::jsonb
    WHERE id = ${goalId}::uuid
  `;
}

/**
 * The shareable field ("nursing", "retail", "law") a work or career-change goal's practice and
 * chapter challenges are set in, sorted once from the learner's role answers and kept on the goal
 * (`details.field`). The learner's words never leave the goal: shared content only ever sees the
 * field. Null for other purposes and when the role names no field.
 *
 * This is a workflow bridge: the goal id comes from the goal the public boundary created.
 */
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
