"use server";

import { adaptPlanFromMock } from "@zoonk/core/exams/mocks/adapt-plan";
import { saveMockAnswer } from "@zoonk/core/exams/mocks/answer";
import {
  type MockView,
  mockAnswerInputSchema,
  mockPlanOfferInputSchema,
  mockTimeZoneInputSchema,
} from "@zoonk/core/exams/mocks/contract";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { submitMockSection } from "@zoonk/core/exams/mocks/submit-section";
import { type MockPlanOfferOutcome } from "@zoonk/learn/mock";
import { z } from "zod";

const blockIdSchema = z.uuid();
const sectionSchema = z.int().min(0);

/** The mock as it now stands, after a step went through. */
async function readMock(blockId: string): Promise<MockView | null> {
  const result = await getMock(blockId);
  return result.status === "ready" ? result.mock : null;
}

/** Saves a draft answer; never says whether it's right. */
export async function saveMockAnswerAction(blockId: unknown, answer: unknown): Promise<boolean> {
  const id = blockIdSchema.safeParse(blockId);
  const input = mockAnswerInputSchema.safeParse(answer);

  if (!id.success || !input.success) {
    return false;
  }

  const result = await saveMockAnswer({ blockId: id.data, input: input.data });
  return result.status === "saved";
}

/** Hands in a section: the next one starts, or the mock ends and comes back graded. */
export async function submitMockSectionAction(
  blockId: unknown,
  section: unknown,
  timeZone: unknown,
) {
  const id = blockIdSchema.safeParse(blockId);
  const index = sectionSchema.safeParse(section);
  const input = mockTimeZoneInputSchema.safeParse({ timeZone });

  if (!id.success || !index.success || !input.success) {
    return null;
  }

  const result = await submitMockSection({
    blockId: id.data,
    input: input.data,
    section: index.data,
  });

  // A section already handed in from another tab still shows the mock as it stands.
  return result.status === "notFound" || result.status === "unauthorized"
    ? null
    : readMock(id.data);
}

/** Ends the mock now and returns it graded. */
export async function finishMockAction(blockId: unknown, timeZone: unknown) {
  const id = blockIdSchema.safeParse(blockId);
  const input = mockTimeZoneInputSchema.safeParse({ timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await finishMock({ blockId: id.data, input: input.data });
  return result.status === "finished" ? readMock(id.data) : null;
}

/** The learner's yes to one of the finished mock's offers: skip what it showed they know, or focus. */
export async function adaptPlanFromMockAction(
  blockId: unknown,
  offer: unknown,
  timeZone: unknown,
): Promise<MockPlanOfferOutcome | null> {
  const id = blockIdSchema.safeParse(blockId);
  const input = mockPlanOfferInputSchema.safeParse({ offer, timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await adaptPlanFromMock({ blockId: id.data, input: input.data });

  if (result.status === "applied") {
    return { lessonsSkipped: result.lessonsSkipped, status: "applied" };
  }

  return result.status === "unchanged" ? { reason: result.reason, status: "unchanged" } : null;
}
