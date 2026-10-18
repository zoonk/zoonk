"use server";

import { anytimeMockInputSchema } from "@zoonk/core/exams/mocks/contract";
import {
  type StartAnytimeMockResult,
  startAnytimeMock,
} from "@zoonk/core/exams/mocks/start-anytime";
import { z } from "zod";

const goalIdSchema = z.uuid();

/**
 * What starting a mock any time came to: it runs (`started`, or the one `running` already), its
 * questions must be written first, it can ask only part of them now (`short`, for the learner to
 * start it knowingly), or why it couldn't start.
 */
export type MockStartOutcome =
  | { id: string; status: "running" | "started" }
  | Extract<StartAnytimeMockResult, { status: "short" }>
  | { status: "failed" | "needsQuestions" | "notEnoughQuestions" };

type KeptRefusal = "needsQuestions" | "notEnoughQuestions";

const KEPT_REFUSALS: readonly KeptRefusal[] = ["needsQuestions", "notEnoughQuestions"];

/** The refusals the screen says in its own words; the rest read as a failed start. */
function isKeptRefusal(status: string): status is KeptRefusal {
  return KEPT_REFUSALS.some((kept) => kept === status);
}

/** "Start" on the mocks to pick from, or the placement mock in onboarding. Inputs are untrusted. */
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

  if (result.status === "short") {
    return result;
  }

  return isKeptRefusal(result.status) ? { status: result.status } : { status: "failed" };
}
