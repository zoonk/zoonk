"use client";

import { attachGoalFile, attachGoalLink, attachGoalText } from "@/lib/goals/goal-uploads";
import { answerUploadRequest } from "@/lib/goals/research-uploads";
import { dismissUploadRequestAction } from "@/lib/goals/upload-request-actions";
import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { UploadRequestCard } from "@zoonk/learn/upload-request";

/** The card's actions, bound to the goal: uploads linked to it, then research with them. */
export function UploadRequestClient({
  className,
  request,
}: {
  className?: string;
  request: GoalUploadRequest;
}) {
  const { goalId } = request;

  return (
    <UploadRequestCard
      actions={{
        answer: (sourceIds) => answerUploadRequest({ goalId, sourceIds }),
        attach: {
          file: (input) => attachGoalFile({ ...input, goalId }),
          link: (input) => attachGoalLink({ ...input, goalId }),
          text: (input) => attachGoalText({ ...input, goalId }),
        },
        dismiss: () => dismissUploadRequestAction(goalId),
      }}
      className={className}
      language={request.language}
      request={request}
    />
  );
}
