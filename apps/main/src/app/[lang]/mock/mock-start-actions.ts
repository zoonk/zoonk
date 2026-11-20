"use server";

import { anytimeMockInputSchema } from "@zoonk/core/exams/mocks/contract";
import { startAnytimeMock } from "@zoonk/core/exams/mocks/start-anytime";
import { uuidSchema } from "@zoonk/utils/uuid-schema";

const goalIdSchema = uuidSchema();

export type MockStartOutcome =
  | { id: string; status: "running" | "started" }
  | { status: "failed" | "preparing" };

export async function startAnytimeMockAction(
  goalId: unknown,
  input: unknown,
): Promise<MockStartOutcome> {
  const id = goalIdSchema.safeParse(goalId);
  const body = anytimeMockInputSchema.safeParse(input);

  if (!id.success || !body.success) {
    return { status: "failed" };
  }

  const result = await startAnytimeMock({ goalId: id.data, input: body.data });

  if ("id" in result) {
    return { id: result.id, status: result.status };
  }

  return { status: result.status === "preparing" ? "preparing" : "failed" };
}
