"use server";

import { assertAdmin } from "@/lib/admin-guard";
import { FeedbackStatus, prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { parseFormField } from "@zoonk/utils/form";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidatePath } from "next/cache";

export type UpdateMessageStatusState = {
  error: string | null;
  status: "idle" | "error" | "success";
  submissionId: number;
};

function parseStatus(value: string | null): FeedbackStatus | undefined {
  return Object.values(FeedbackStatus).find((status) => status === value);
}

/** Admins triage form messages by marking them read or replied, or back to new. */
export async function updateMessageStatusAction(
  previousState: UpdateMessageStatusState,
  formData: FormData,
): Promise<UpdateMessageStatusState> {
  await assertAdmin();

  const submissionId = previousState.submissionId + 1;
  const messageId = parseFormField(formData, "messageId");
  const status = parseStatus(parseFormField(formData, "status"));

  if (!isUuid(messageId) || !status) {
    return { error: "Invalid message or status.", status: "error", submissionId };
  }

  const { error } = await safeAsync(() =>
    prisma.feedback.update({ data: { status }, where: { id: messageId } }),
  );

  if (error) {
    return { error: "Could not update the message. Please try again.", status: "error", submissionId };
  }

  revalidatePath("/feedback/messages");
  revalidatePath(`/feedback/messages/${messageId}`);

  return { error: null, status: "success", submissionId };
}
