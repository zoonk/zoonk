"use client";

import { useRouter } from "@/i18n/navigation";
import {
  attachGoalFile,
  attachGoalLink,
  attachGoalText,
  readUploadStatus,
} from "@/lib/goals/goal-uploads";
import { answerUploadRequest } from "@/lib/goals/research-uploads";
import { dismissUploadRequestAction } from "@/lib/goals/upload-request-actions";
import { type GoalUploadRequest } from "@zoonk/core/library/sources/upload-request";
import { type AttachedSource } from "@zoonk/learn/onboarding/actions";
import {
  Suggestion,
  SuggestionContent,
  SuggestionLine,
  SuggestionOpen,
  SuggestionResult,
  SuggestionSummary,
} from "@zoonk/learn/suggestion";
import {
  UploadRequestCard,
  type UploadRequestView,
  useAnsweredUploadRead,
  useRequestCopy,
} from "@zoonk/learn/upload-request";
import { FileSearchIcon } from "lucide-react";
import { useExtracted } from "next-intl";

/**
 * The host keeps the learner's answer, so it thanks after `onAnswered` while the upload is read, asks
 * again after `onUnreadable` and takes the ask away after `onDismissed`.
 */
export function UploadRequestClient({
  answered,
  onAnswered,
  onDismissed,
  onUnreadable,
  request,
}: {
  answered: AttachedSource | null;
  onAnswered: (source: AttachedSource) => void;
  onDismissed: () => void;
  onUnreadable: (source: AttachedSource) => void;
  request: GoalUploadRequest & UploadRequestView;
}) {
  const t = useExtracted();
  const router = useRouter();
  const copy = useRequestCopy(request);
  const { goalId } = request;

  useAnsweredUploadRead({
    answered,
    onUnreadable: (source) => {
      onUnreadable(source);
      router.refresh();
    },
    read: readUploadStatus,
  });

  return (
    <Suggestion
      answered={answered !== null}
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
              answer: async (source) => {
                const outcome = await answerUploadRequest({ goalId, sourceIds: [source.id] });

                // The API leaves the page alone, so the page reads itself again to keep the ask answered.
                if (outcome === "answered") {
                  onAnswered(source);
                  router.refresh();
                }

                return outcome;
              },
              attach: {
                file: (input) => attachGoalFile({ ...input, goalId }),
                link: (input) => attachGoalLink({ ...input, goalId }),
                readStatus: readUploadStatus,
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
