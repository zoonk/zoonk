import "server-only";
import { type MockExam, type StudySessionBlock, type TransactionClient } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { claimGuestShare } from "../../entitlements/_utils/guest-spend-budget";
import { ESSAY_GRADE_COST_MICROS } from "../../entitlements/limits";
import { getAnswerAttemptId } from "../../learner/_utils/answer-once";
import { addDays, toIsoDate } from "../../plans/planner/plan-calendar";
import { readBlockPayload } from "../../sessions/block-payload";
import { writtenAnswerSchema } from "./writing-contract";

const DAILY_EXTRA_WRITES = 6;

export class InvalidWritingRewriteError extends Error {
  override name = "InvalidWritingRewriteError";
}

type WritingOwner = { blockId: string; previousAttemptId?: string } | { mockId: string };

export async function countWritingExtrasLeft({
  localDate,
  tx,
  userId,
}: {
  localDate: Date;
  tx: TransactionClient;
  userId: string;
}): Promise<number> {
  const used = await tx.writingAdmission.count({ where: { extra: true, localDate, userId } });
  return Math.max(0, DAILY_EXTRA_WRITES - used);
}

export async function readWritingExtraLimit({
  localDate,
  tx,
  userId,
}: {
  localDate: Date;
  tx: TransactionClient;
  userId: string;
}): Promise<{ returnsOn: string; status: "limitReached" } | null> {
  const left = await countWritingExtrasLeft({ localDate, tx, userId });

  return left === 0
    ? { returnsOn: toIsoDate(addDays(localDate, 1)), status: "limitReached" }
    : null;
}

export function getWritingAdmissionId(owner: WritingOwner): string {
  const key = "blockId" in owner ? (owner.previousAttemptId ?? "first") : "mock";
  const questionId = "blockId" in owner ? owner.blockId : owner.mockId;
  return getAnswerAttemptId({ key, questionId, userId: "writing-admission" });
}

// The caller holds the usage lock and passes an owned target read in this transaction.
export async function admitWriting({
  extra,
  itemIds,
  localDate,
  owner,
  tx,
  userId,
}: {
  extra: boolean;
  itemIds: string[];
  localDate: Date;
  owner: { block: StudySessionBlock; previousAttemptId?: string } | { mock: MockExam };
  tx: TransactionClient;
  userId: string;
}): Promise<
  | { admissionId: string; status: "ready" }
  | { returnsOn: string; status: "limitReached" }
  | { status: "signUpRequired" }
> {
  const admissionId = getWritingAdmissionId(
    "block" in owner
      ? { blockId: owner.block.id, previousAttemptId: owner.previousAttemptId }
      : { mockId: owner.mock.id },
  );

  const target =
    "block" in owner
      ? blockAdmission({ block: owner.block, tx, userId })
      : mockAdmission({ mock: owner.mock, tx });

  const previousAttemptId = "block" in owner ? owner.previousAttemptId : undefined;

  if (target.currentId && (!previousAttemptId || target.currentId === admissionId)) {
    return { admissionId: target.currentId, status: "ready" };
  }

  if (previousAttemptId && "checkRewrite" in target) {
    await target.checkRewrite(previousAttemptId, itemIds[0]);
  }

  const refusal = extra ? await readWritingExtraLimit({ localDate, tx, userId }) : null;

  if (refusal) {
    return refusal;
  }

  if (
    !(await claimGuestShare({
      costMicros: itemIds.length * ESSAY_GRADE_COST_MICROS,
      transaction: tx,
      userId,
    }))
  ) {
    return { status: "signUpRequired" };
  }

  await tx.writingAdmission.create({
    data: { extra, id: admissionId, itemIds, localDate, userId },
  });

  await target.save(admissionId, itemIds);

  return { admissionId, status: "ready" };
}

function blockAdmission({
  block,
  tx,
  userId,
}: {
  block: StudySessionBlock;
  tx: TransactionClient;
  userId: string;
}) {
  const payload = readBlockPayload(block);
  const { writing } = payload;

  if (block.kind !== "produce" || !writing) {
    throw new Error("Writing admission requires an owned writing block.");
  }

  return {
    checkRewrite: async (previousAttemptId: string, itemId: string | undefined) => {
      const previous = await tx.attempt.findFirst({
        where: {
          id: previousAttemptId,
          itemId: payload.itemIds[0],
          studySessionId: block.sessionId,
          userId,
        },
      });

      const answered = writtenAnswerSchema.safeParse(previous?.answer);

      if (
        !answered.success ||
        answered.data.conditions.admissionId !== writing.admissionId ||
        itemId !== payload.itemIds[0]
      ) {
        throw new InvalidWritingRewriteError("Rewriting requires the block's latest saved answer.");
      }
    },
    currentId: writing.admissionId,
    save: (admissionId: string, itemIds: string[]) =>
      tx.studySessionBlock.update({
        data: {
          payload: { ...payload, itemIds, writing: { ...writing, admissionId, draft: null } },
        },
        where: { id: block.id },
      }),
  };
}

function mockAdmission({ mock, tx }: { mock: MockExam; tx: TransactionClient }) {
  if (!isJsonObject(mock.conditions)) {
    throw new Error("Writing admission requires an owned mock.");
  }

  const conditions = mock.conditions;

  return {
    currentId: getString(conditions, "writingAdmissionId"),
    save: (writingAdmissionId: string) =>
      tx.mockExam.update({
        data: { conditions: { ...conditions, writingAdmissionId } },
        where: { id: mock.id },
      }),
  };
}
