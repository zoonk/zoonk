"use client";

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
export function UploadRequestClient({ request }: { request: GoalUploadRequest }) {
  const t = useExtracted();
  const copy = useRequestCopy(request);
  const [state, setState] = useState<RequestState>("asking");
  const { goalId } = request;

  const settle = (done: RequestState) => (saved: boolean) => {
    if (saved) {
      setState(done);
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
