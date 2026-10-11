import "server-only";
import { DbNull, prisma } from "@zoonk/db";
import { judgeForwardOnlySave } from "./_utils/mock-navigation";
import { findOwnedMock, getSectionDeadline } from "./_utils/owned-mock";
import { type MockAnswerInput } from "./mock-answer-contract";
import { type MockConditions } from "./mock-contract";

/** A slow network shouldn't lose the last answer given right before time ran out. */
const DEADLINE_GRACE_MS = 30_000;

export type SaveMockAnswerResult = {
  status:
    | "invalidItem"
    | "locked"
    | "notFound"
    | "notRunning"
    | "saved"
    | "timeUp"
    | "unauthorized";
};

/**
 * Whether the answer fits what the running section asks: an answer (or a blank) for one of its
 * questions, text only for a question typed in words, and an essay's text (or a blank) for one of
 * its essays.
 */
async function fitsSection({
  input,
  section,
}: {
  input: MockAnswerInput;
  section: MockConditions["sections"][number] | undefined;
}): Promise<boolean> {
  const isText = input.answer !== null && "text" in input.answer;

  if (section?.essays.includes(input.itemId)) {
    return input.answer === null || isText;
  }

  if (!section?.itemIds.includes(input.itemId)) {
    return false;
  }

  if (!isText) {
    return true;
  }

  const item = await prisma.item.findUnique({
    select: { format: true },
    where: { id: input.itemId },
  });

  return item?.format === "typed";
}

/**
 * Whether the section's rules let this answer change (see `judgeForwardOnlySave`): any answer in a
 * section that moves freely.
 */
async function judgeMove({
  input,
  mockId,
  section,
}: {
  input: MockAnswerInput;
  mockId: string;
  section: MockConditions["sections"][number];
}): Promise<{ changed: boolean; status: "locked" | "saved" }> {
  if (!section.navigation?.forwardOnly) {
    return { changed: false, status: "saved" };
  }

  const rows = await prisma.mockExamAnswer.findMany({
    select: { answer: true, changes: true, itemId: true },
    where: { itemId: { in: section.itemIds }, mockExamId: mockId },
  });

  return judgeForwardOnlySave({
    answer: input.answer,
    itemId: input.itemId,
    itemIds: section.itemIds,
    navigation: section.navigation,
    rows,
  });
}

/**
 * Saves a draft answer in the running section, like marking an answer sheet: a pick, a number, a
 * typed word or a blank (an essay's text so far), whether it's flagged to come back to, and the
 * time spent on it.
 * Nothing is graded and nothing says whether it's right until the mock ends. Once a section's time
 * runs out, it takes no more; a section that never goes back keeps the answers left behind
 * ("locked"), but for the changes its end review allows.
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

  // On the break between sections, the next one hasn't started: its answers wait.
  if (mock.sectionStartedAt.getTime() > Date.now()) {
    return { status: "notRunning" };
  }

  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section || !(await fitsSection({ input, section }))) {
    return { status: "invalidItem" };
  }

  if (Date.now() > getSectionDeadline(mock).getTime() + DEADLINE_GRACE_MS) {
    return { status: "timeUp" };
  }

  const move = await judgeMove({ input, mockId: mock.id, section });

  if (move.status === "locked") {
    return { status: "locked" };
  }

  const draft = {
    answer: input.answer ?? DbNull,
    durationMs: input.durationMs,
    flagged: input.flagged,
  };

  await prisma.mockExamAnswer.upsert({
    create: { ...draft, itemId: input.itemId, mockExamId: mock.id },
    update: { ...draft, ...(move.changed ? { changes: { increment: 1 } } : {}) },
    where: { mockItem: { itemId: input.itemId, mockExamId: mock.id } },
  });

  return { status: "saved" };
}
