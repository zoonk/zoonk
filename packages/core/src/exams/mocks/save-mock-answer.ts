import "server-only";
import { DbNull, prisma } from "@zoonk/db";
import { findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";
import { type MockAnswerInput } from "./mock-contract";

/** A slow network shouldn't lose the last answer given right before time ran out. */
const DEADLINE_GRACE_MS = 30_000;

export type SaveMockAnswerResult = {
  status: "invalidItem" | "notFound" | "notRunning" | "saved" | "timeUp" | "unauthorized";
};

/**
 * Saves a draft answer in the running section, like marking an answer sheet: a pick or a blank,
 * whether it's flagged to come back to, and the time spent on it. Nothing is graded and nothing
 * says whether it's right until the mock ends. Once a section's time runs out, it takes no more.
 */
export async function saveMockAnswer({
  blockId,
  input,
}: {
  blockId: string;
  input: MockAnswerInput;
}): Promise<SaveMockAnswerResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { mock } = found.owned;

  if (mock?.status !== "active") {
    return { status: "notRunning" };
  }

  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section?.itemIds.includes(input.itemId)) {
    return { status: "invalidItem" };
  }

  if (Date.now() > getSectionDeadline(mock).getTime() + DEADLINE_GRACE_MS) {
    return { status: "timeUp" };
  }

  const draft = {
    answer: input.answer ?? DbNull,
    durationMs: input.durationMs,
    flagged: input.flagged,
  };

  await prisma.mockExamAnswer.upsert({
    create: { ...draft, itemId: input.itemId, mockExamId: mock.id },
    update: draft,
    where: { mockItem: { itemId: input.itemId, mockExamId: mock.id } },
  });

  return { status: "saved" };
}
