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

/**
 * The host keeps the learner's answer, so it thanks after `onAnswered` and takes the ask away after
 * `onDismissed`.
 */
export function UploadRequestClient({
  answered,
  onAnswered,
  onDismissed,
  request,
}: {
  answered: boolean;
  onAnswered: () => void;
  onDismissed: () => void;
  request: GoalUploadRequest;
}) {
  const t = useExtracted();
  const router = useRouter();
  const copy = useRequestCopy(request);
  const { goalId } = request;

  return (
    <Suggestion
      answered={answered}
      label={t("Your plan needs a document")}
      mark={<FileSearchIcon />}
    >
      <SuggestionLine>
        {answered ? (
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
        {answered ? (
          <SuggestionResult>
            {t("Thanks. We're reading it now, and your plan will update in a few minutes.")}
          </SuggestionResult>
        ) : (
          <UploadRequestCard
            actions={{
              answer: async (sourceIds) => {
                const outcome = await answerUploadRequest({ goalId, sourceIds });

                // The API leaves the page alone, so the page reads itself again to keep the ask answered.
                if (outcome === "answered") {
                  onAnswered();
                  router.refresh();
                }

                return outcome;
              },
              attach: {
                file: (input) => attachGoalFile({ ...input, goalId }),
                link: (input) => attachGoalLink({ ...input, goalId }),
                text: (input) => attachGoalText({ ...input, goalId }),
              },
              dismiss: async () => {
                const dismissed = await dismissUploadRequestAction(goalId);

                if (dismissed) {
                  onDismissed();
                }

                return dismissed;
              },
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
