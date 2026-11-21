import "server-only";
import { isDeepStrictEqual } from "node:util";
import { DbNull, type TransactionClient } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { judgeForwardOnlySave } from "./_utils/mock-navigation";
import {
  type MockSitting,
  findMockSitting,
  findOwnedMock,
  getSectionDeadline,
} from "./_utils/owned-mock";
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

async function fitsSection({
  input,
  section,
  tx,
}: {
  input: MockAnswerInput;
  section: MockConditions["sections"][number] | undefined;
  tx: TransactionClient;
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

  const item = await tx.item.findUnique({ select: { format: true }, where: { id: input.itemId } });

  return item?.format === "typed";
}

function judgeMove({
  input,
  mock,
  section,
}: {
  input: MockAnswerInput;
  mock: MockSitting;
  section: MockConditions["sections"][number];
}): { changed: boolean; status: "locked" | "saved" } {
  if (!section.navigation?.forwardOnly) {
    return { changed: false, status: "saved" };
  }

  return judgeForwardOnlySave({
    answer: input.answer,
    itemId: input.itemId,
    itemIds: section.itemIds,
    navigation: section.navigation,
    rows: mock.answers.filter((row) => section.itemIds.includes(row.itemId)),
  });
}

async function judgeSave({
  input,
  mock,
  tx,
}: {
  input: MockAnswerInput;
  mock: MockSitting | null;
  tx: TransactionClient;
}): Promise<
  | { changed: boolean; status: "saved" }
  | { status: Exclude<SaveMockAnswerResult["status"], "saved"> }
> {
  if (mock?.status !== "active" || mock.sectionStartedAt.getTime() > Date.now()) {
    return { status: "notRunning" };
  }

  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section || !(await fitsSection({ input, section, tx }))) {
    return { status: "invalidItem" };
  }

  if (Date.now() > getSectionDeadline(mock).getTime() + DEADLINE_GRACE_MS) {
    return { status: "timeUp" };
  }

  return judgeMove({ input, mock, section });
}

/** Judges the save against the sitting read under the learner's lock, which hand-ins take too. */
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

  const mockId = found.owned.mock?.id;

  if (!mockId) {
    return { status: "notRunning" };
  }

  return writeLearnerChange<SaveMockAnswerResult>({ userId: found.owned.userId }, async (tx) => {
    const mock = await findMockSitting(tx, mockId);
    const judged = await judgeSave({ input, mock, tx });

    if (judged.status !== "saved") {
      return unchanged({ status: judged.status });
    }

    const saved = mock?.answers.find((row) => row.itemId === input.itemId);

    if (
      saved &&
      isDeepStrictEqual(saved.answer, input.answer ?? null) &&
      saved.durationMs === input.durationMs &&
      saved.flagged === input.flagged
    ) {
      return unchanged({ status: "saved" });
    }

    const draft = {
      answer: input.answer ?? DbNull,
      durationMs: input.durationMs,
      flagged: input.flagged,
    };

    await tx.mockExamAnswer.upsert({
      create: { ...draft, itemId: input.itemId, mockExamId: mockId },
      update: { ...draft, ...(judged.changed ? { changes: { increment: 1 } } : {}) },
      where: { mockItem: { itemId: input.itemId, mockExamId: mockId } },
    });

    return { status: "saved" };
  });
}
