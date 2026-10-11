"use server";

import { adaptPlanFromMock } from "@zoonk/core/exams/mocks/adapt-plan";
import { saveMockAnswer } from "@zoonk/core/exams/mocks/answer";
import { mockAnswerInputSchema } from "@zoonk/core/exams/mocks/answer-contract";
import {
  type MockView,
  mockPlanOfferInputSchema,
  mockTimeZoneInputSchema,
} from "@zoonk/core/exams/mocks/contract";
import { endMockBreak } from "@zoonk/core/exams/mocks/end-break";
import { finishMock } from "@zoonk/core/exams/mocks/finish";
import { getMock } from "@zoonk/core/exams/mocks/get";
import { gradeMockEssays } from "@zoonk/core/exams/mocks/grade-essays";
import { recordMockPlay } from "@zoonk/core/exams/mocks/record-play";
import { startMockSpeaking } from "@zoonk/core/exams/mocks/start-speaking";
import { submitMockSection } from "@zoonk/core/exams/mocks/submit-section";
import {
  type MockEssayGrading,
  type MockPlanOfferOutcome,
  type MockPlayOutcome,
} from "@zoonk/learn/mock";
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

/** Ends the break between two sections now; the mock as it stands either way. */
export async function endMockBreakAction(blockId: unknown) {
  const id = blockIdSchema.safeParse(blockId);

  if (!id.success) {
    return null;
  }

  // A break that ran out on its own already started the next section: the mock shows it.
  await endMockBreak({ blockId: id.data });
  return readMock(id.data);
}

/** Counts a play of the running listening section's recording as it starts. */
export async function recordMockPlayAction(
  blockId: unknown,
  setId: unknown,
): Promise<MockPlayOutcome | null> {
  const id = blockIdSchema.safeParse(blockId);
  const set = blockIdSchema.safeParse(setId);

  if (!id.success || !set.success) {
    return null;
  }

  const result = await recordMockPlay({ blockId: id.data, setId: set.data });

  return result.status === "counted" || result.status === "usedUp"
    ? { played: result.played, status: result.status }
    : null;
}

/**
 * Starts the running speaking section: its paper's task cards are written now (model calls), or
 * the ones already written come back; the mock as it stands, with its paper.
 */
export async function startMockSpeakingAction(blockId: unknown) {
  const id = blockIdSchema.safeParse(blockId);

  if (!id.success) {
    return null;
  }

  const result = await startMockSpeaking({ blockId: id.data });
  return result.status === "ready" ? readMock(id.data) : null;
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

/**
 * Grades the finished mock's essays with the exam's rubric, right after hand-in (a model call per
 * essay), and returns the mock with their grades, or why some wait for another day.
 */
export async function gradeMockEssaysAction(
  blockId: unknown,
  timeZone: unknown,
): Promise<MockEssayGrading | null> {
  const id = blockIdSchema.safeParse(blockId);
  const input = mockTimeZoneInputSchema.safeParse({ timeZone });

  if (!id.success || !input.success) {
    return null;
  }

  const result = await gradeMockEssays({ blockId: id.data, input: input.data });

  if (result.status !== "graded" && result.status !== "limitReached") {
    return null;
  }

  const mock = await readMock(id.data);
  return mock ? { mock, status: result.status } : null;
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
