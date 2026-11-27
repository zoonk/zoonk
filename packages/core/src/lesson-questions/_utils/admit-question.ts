import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { type EntitlementViewer } from "../../entitlements/_utils/entitlement-viewer";
import { claimUsageInWrite } from "../../entitlements/claim-usage";
import { type UsageDecision } from "../../entitlements/contract";
import { completeFromSharedAnswer } from "./answer-claim";
import { type LessonQuestionResourceSource } from "./question-resource";

export type QuestionAdmission =
  | { question: LessonQuestionResourceSource; status: "admitted" }
  | { decision: Exclude<UsageDecision, { status: "allowed" }>; status: "usageRefused" };

/**
 * A question with a shared answer is completed with it as it's saved, using no allowance. Any
 * other claims its answer from the tutor allowance in the write that saves it, so a refused question
 * is never saved; the answer's own claim, keyed by the same id, then replays this one.
 */
export async function admitQuestion({
  question,
  transaction,
  viewer,
}: {
  question: Parameters<typeof completeFromSharedAnswer>[0]["question"] &
    LessonQuestionResourceSource;
  transaction: TransactionClient;
  viewer: EntitlementViewer;
}): Promise<QuestionAdmission> {
  const answered = await completeFromSharedAnswer({ question, transaction, userId: viewer.userId });

  if (answered) {
    return { question: answered, status: "admitted" };
  }

  const usage = await claimUsageInWrite({
    kind: "tutorMessage",
    targetId: question.id,
    transaction,
    viewer,
  });

  return usage.status === "allowed"
    ? { question, status: "admitted" }
    : { decision: usage, status: "usageRefused" };
}
