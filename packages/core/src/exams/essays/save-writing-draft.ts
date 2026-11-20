import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { lockUsageForViewer } from "../../entitlements/_utils/usage-lock";
import { markLearnerChanged } from "../../learner/_utils/mark-learner-changed";
import { readBlockPayload } from "../../sessions/block-payload";
import { getSession } from "../../users/get-session";
import { getWritingAttemptId } from "./writing-admission";
import { type WritingDraft } from "./writing-contract";

export async function saveWritingDraft({
  blockId,
  input,
}: {
  blockId: string;
  input: WritingDraft;
}) {
  const actor = await getSession();

  if (!actor) {
    return { status: "unauthorized" as const };
  }

  if (!isUuid(blockId)) {
    return { status: "notFound" as const };
  }

  const userId = actor.user.id;

  return prisma.$transaction(async (tx) => {
    await markLearnerChanged(tx, { userId });
    await lockUsageForViewer({ transaction: tx, userId });

    const block = await tx.studySessionBlock.findFirst({
      where: { id: blockId, kind: "produce", session: { userId } },
    });

    if (!block || block.status === "skipped") {
      return { status: "notFound" as const };
    }

    const payload = readBlockPayload(block);
    const { writing } = payload;
    const [itemId] = payload.itemIds;

    if (!writing?.admissionId || !itemId || writing.admissionId !== input.admissionId) {
      return { status: "notFound" as const };
    }

    const submitted = await tx.attempt.findFirst({
      select: { id: true },
      where: { id: getWritingAttemptId({ admissionId: input.admissionId, itemId }), userId },
    });

    if (submitted) {
      return { status: "alreadySubmitted" as const };
    }

    const current = {
      admissionId: writing.admissionId,
      revision: writing.draft?.revision ?? 0,
      text: writing.draft?.text ?? "",
    };

    if (current.revision !== input.revision) {
      return { draft: current, status: "conflict" as const };
    }

    const draft = { revision: current.revision + 1, text: input.text };

    await tx.studySessionBlock.update({
      data: { payload: { ...payload, writing: { ...writing, draft } } },
      where: { id: blockId },
    });

    return { draft: { ...draft, admissionId: input.admissionId }, status: "ready" as const };
  });
}
