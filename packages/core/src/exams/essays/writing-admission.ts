import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
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
  owner: WritingOwner;
  tx: TransactionClient;
  userId: string;
}): Promise<
  { admissionId: string; status: "ready" } | { returnsOn: string; status: "limitReached" }
> {
  await lockUsageForViewer({ transaction: tx, userId });

  const admissionId = getWritingAdmissionId(owner);

  const target =
    "blockId" in owner
      ? await findBlockAdmission({ owner, tx, userId })
      : await findMockAdmission({ mockId: owner.mockId, tx, userId });

  const previousAttemptId = "blockId" in owner ? owner.previousAttemptId : undefined;

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

  await tx.writingAdmission.create({
    data: { extra, id: admissionId, itemIds, localDate, userId },
  });

  await target.save(admissionId, itemIds);

  return { admissionId, status: "ready" };
}

async function findBlockAdmission({
  owner,
  tx,
  userId,
}: {
  owner: Extract<WritingOwner, { blockId: string }>;
  tx: TransactionClient;
  userId: string;
}) {
  const block = await tx.studySessionBlock.findFirst({
    where: { id: owner.blockId, kind: "produce", session: { userId } },
  });

  const payload = block ? readBlockPayload(block) : null;
  const writing = payload?.writing;

  if (!block || !payload || !writing) {
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

async function findMockAdmission({
  mockId,
  tx,
  userId,
}: {
  mockId: string;
  tx: TransactionClient;
  userId: string;
}) {
  const mock = await tx.mockExam.findFirst({ where: { id: mockId, userId } });

  if (!mock || !isJsonObject(mock.conditions)) {
    throw new Error("Writing admission requires an owned mock.");
  }

  const conditions = mock.conditions;

  return {
    currentId: getString(conditions, "writingAdmissionId"),
    save: (writingAdmissionId: string) =>
      tx.mockExam.update({
        data: { conditions: { ...conditions, writingAdmissionId } },
        where: { id: mockId },
      }),
  };
}
