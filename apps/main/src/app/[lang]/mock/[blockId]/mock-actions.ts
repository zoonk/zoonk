"use server";

import { saveMockAnswer } from "@zoonk/core/exams/mocks/answer";
import {
  type MockView,
  mockAnswerInputSchema,
  mockTimeZoneInputSchema,
} from "@zoonk/core/exams/mocks/contract";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { startMock } from "@zoonk/core/exams/mocks/start";
import { submitMockSection } from "@zoonk/core/exams/mocks/submit-section";
import { z } from "zod";

const blockIdSchema = z.uuid();
const sectionSchema = z.int().min(0);

/** The mock as it now stands, after a step went through. */
async function readMock(blockId: string): Promise<MockView | null> {
  const result = await getMock(blockId);
  return result.status === "ready" ? result.mock : null;
}

/**
 * Starts the mock (or resumes it) and returns it running. Inputs are untrusted, so they're
 * parsed with the API's schemas.
 */
export async function startMockAction(blockId: unknown, timeZone: unknown) {
  const id = blockIdSchema.safeParse(blockId);
  const input = mockTimeZoneInputSchema.safeParse({ timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await startMock({ blockId: id.data, input: input.data });
  return result.status === "ready" ? readMock(id.data) : null;
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
