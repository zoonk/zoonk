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

export function UploadRequestClient({
  answered = false,
  onAnswered,
  request,
}: {
  answered?: boolean;
  onAnswered?: () => void;
  request: GoalUploadRequest;
}) {
  const t = useExtracted();
  const router = useRouter();
  const copy = useRequestCopy(request);
  const [answer, setAnswer] = useState<RequestState>("asking");

  // The host's word wins, so an ask shown again before the answer arrived still thanks.
  const state: RequestState = answered ? "answered" : answer;
  const { goalId } = request;

  const settle = (done: RequestState) => (saved: boolean) => {
    if (saved) {
      setAnswer(done);
    }

    // The API leaves the page alone, so the page reads itself again to keep the ask answered.
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
