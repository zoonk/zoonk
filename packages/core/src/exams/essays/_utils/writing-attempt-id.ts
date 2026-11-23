import { getAnswerAttemptId } from "../../../learner/_utils/answer-once";

export function getWritingAttemptId({
  admissionId,
  itemId,
}: {
  admissionId: string;
  itemId: string;
}) {
  return getAnswerAttemptId({ key: "writing-admission", questionId: itemId, userId: admissionId });
}
