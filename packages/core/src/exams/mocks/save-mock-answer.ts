import "server-only";
import { isDeepStrictEqual } from "node:util";
import { DbNull, type MockExamAnswer, type TransactionClient } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { judgeForwardOnlySave } from "./_utils/mock-navigation";
import {
  type MockSitting,
  findMockSitting,
  findOwnedMock,
  getSectionDeadline,
} from "./_utils/owned-mock";
import {
  MAX_OBJECTIVE_ANSWER_CHARACTERS,
  MAX_OBJECTIVE_ANSWER_DURATION_MS,
  MOCK_ANSWER_DEADLINE_GRACE_MS,
  type MockAnswerInput,
} from "./mock-answer-contract";
import { type MockConditions } from "./mock-contract";

export type SaveMockAnswerResult = {
  status:
    | "invalidItem"
    | "locked"
    | "notFound"
    | "notRunning"
    | "saved"
    | "staleAnswer"
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

  if (
    !section?.itemIds.includes(input.itemId) ||
    input.durationMs > MAX_OBJECTIVE_ANSWER_DURATION_MS
  ) {
    return false;
  }

  if (!isText) {
    return true;
  }

  const item = await tx.item.findUnique({ select: { format: true }, where: { id: input.itemId } });

  return (
    item?.format === "typed" &&
    input.answer !== null &&
    "text" in input.answer &&
    input.answer.text.length <= MAX_OBJECTIVE_ANSWER_CHARACTERS
  );
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

function keptEditStatus({
  input,
  saved,
}: {
  input: MockAnswerInput;
  saved: MockExamAnswer | null;
}): "saved" | "staleAnswer" | null {
  const { edit } = input;

  if (!edit) {
    return null;
  }

  if (saved?.editWriter !== edit.writer) {
    return (saved?.revision ?? saved?.id) === edit.base ? null : "staleAnswer";
  }

  if ((saved.editOrder ?? -1) < edit.order) {
    return null;
  }

  return saved.editOrder === edit.order &&
    isDeepStrictEqual(saved.answer, input.answer) &&
    saved.flagged === input.flagged
    ? "saved"
    : "staleAnswer";
}

function creditedDuration({
  input,
  mock,
  now,
  section,
}: {
  input: MockAnswerInput;
  mock: MockSitting;
  now: number;
  section: MockConditions["sections"][number];
}): number {
  if (!section.essays.includes(input.itemId)) {
    return input.durationMs;
  }

  const elapsed =
    Math.min(now, getSectionDeadline(mock).getTime()) - mock.sectionStartedAt.getTime();

  return Math.min(input.durationMs, Math.max(0, elapsed));
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
  | { changed: boolean; durationMs: number; status: "saved" }
  | { status: Exclude<SaveMockAnswerResult["status"], "saved"> }
> {
  const now = Date.now();

  if (mock?.status !== "active" || mock.sectionStartedAt.getTime() > now) {
    return { status: "notRunning" };
  }

  const section = mock.conditions.sections[mock.sectionIndex];

  if (!section || !(await fitsSection({ input, section, tx }))) {
    return { status: "invalidItem" };
  }

  if (now > getSectionDeadline(mock).getTime() + MOCK_ANSWER_DEADLINE_GRACE_MS) {
    return { status: "timeUp" };
  }

  const move = judgeMove({ input, mock, section });

  return move.status === "locked"
    ? { status: move.status }
    : { ...move, durationMs: creditedDuration({ input, mock, now, section }), status: "saved" };
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

    const saved = mock?.answers.find((row) => row.itemId === input.itemId) ?? null;
    const status = keptEditStatus({ input, saved });

    if (status) {
      return unchanged({ status });
    }

    const { durationMs } = judged;

    if (
      !input.edit &&
      saved &&
      isDeepStrictEqual(saved.answer, input.answer ?? null) &&
      saved.durationMs === durationMs &&
      saved.flagged === input.flagged
    ) {
      return unchanged({ status: "saved" });
    }

    const draft = {
      answer: input.answer ?? DbNull,
      durationMs,
      editOrder: input.edit?.order ?? null,
      editWriter: input.edit?.writer ?? null,
      flagged: input.flagged,
      revision: crypto.randomUUID(),
    };

    await tx.mockExamAnswer.upsert({
      create: {
        ...draft,
        changes: judged.changed ? 1 : 0,
        itemId: input.itemId,
        mockExamId: mockId,
      },
      update: { ...draft, ...(judged.changed ? { changes: { increment: 1 } } : {}) },
      where: { mockItem: { itemId: input.itemId, mockExamId: mockId } },
    });

    return { status: "saved" };
  });
}
