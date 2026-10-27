"use client";

import { useRouter } from "@/i18n/navigation";
import { attachGoalFile, attachGoalLink, attachGoalText } from "@/lib/goals/goal-uploads";
import { answerUploadRequest } from "@/lib/goals/research-uploads";
import { dismissUploadRequestAction } from "@/lib/goals/upload-request-actions";
import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import {
  Suggestion,
  SuggestionContent,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "@zoonk/learn/suggestion";
import { UploadRequestCard, useRequestCopy } from "@zoonk/learn/upload-request";
import { FileSearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useState } from "react";

type RequestState = "answered" | "asking" | "dismissed";

/**
 * Research's ask for a document, as Today's notice: one line that opens the ask in a sheet on a
 * phone or a tablet, the ask itself in the aside from 72rem. The card's actions are bound to the
 * goal (uploads linked to it, then research with them); the line follows what they did. "Not now"
 * takes the ask away for good.
 */
export function UploadRequestClient({
  answered = false,
  onAnswered,
  request,
}: {
  /** The learner answered it here this visit (the host keeps that), so it shows its thanks. */
  answered?: boolean;
  /** The learner answered it here: the host keeps it, and its thanks, while they stay. */
  onAnswered?: () => void;
  request: GoalUploadRequest;
}) {
  const t = useExtracted();
  const router = useRouter();
  const copy = useRequestCopy(request);
  const [answer, setAnswer] = useState<RequestState>("asking");

  // The host's word that it was answered here wins over this instance's own, so an ask shown
  // again before the answer arrived (a read that dropped it, then one that brought it back) thanks.
  const state: RequestState = answered ? "answered" : answer;
  const { goalId } = request;

  const settle = (done: RequestState) => (saved: boolean) => {
    if (saved) {
      setAnswer(done);
    }

    // The answer goes to the API, which leaves the page alone: the page reads itself again, so the
    // ask stays answered when the learner comes back to it. A dismissal renders it again itself.
    if (saved && done === "answered") {
      onAnswered?.();
      router.refresh();
    }

    return saved;
  };

  if (state === "dismissed") {
    return null;
  }

  return (
    <Suggestion
      answered={state === "answered"}
      label={t("Your plan needs a document")}
      mark={<FileSearchIcon />}
    >
      <SuggestionLine>
        {state === "answered" ? (
          <SuggestionResult>
            {t("Thanks. We're reading it now, and your plan will update in a few minutes.")}
          </SuggestionResult>
        ) : (
          <>
            <SuggestionSummary>{copy.title}</SuggestionSummary>
            <SuggestionOpen>{t("Upload")}</SuggestionOpen>
          </>
        )}
      </SuggestionLine>

      <SuggestionContent>
        {state === "answered" ? (
          <SuggestionResult>
            {t("Thanks. We're reading it now, and your plan will update in a few minutes.")}
          </SuggestionResult>
        ) : (
          <UploadRequestCard
            actions={{
              answer: (sourceIds) =>
                answerUploadRequest({ goalId, sourceIds }).then(settle("answered")),
              attach: {
                file: (input) => attachGoalFile({ ...input, goalId }),
                link: (input) => attachGoalLink({ ...input, goalId }),
                text: (input) => attachGoalText({ ...input, goalId }),
              },
              dismiss: () => dismissUploadRequestAction(goalId).then(settle("dismissed")),
            }}
            className="rounded-none bg-transparent p-0"
            language={request.language}
            request={request}
          />
        )}
      </SuggestionContent>
    </Suggestion>
  );
}
