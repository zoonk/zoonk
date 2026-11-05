"use client";

import { Button } from "@zoonk/ui/components/button";
import { Marker, MarkerContent } from "@zoonk/ui/components/marker";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo } from "react";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { QuestionErrorAction, RequestErrorMessage, toHelpLimit } from "./lesson-question-errors";
import { LessonQuestionMarkdown } from "./lesson-question-markdown";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { type TutorAnswerLinks } from "./tutor-markdown";

function AnswerFailureMessage({ error }: { error: LessonQuestionApiError | null }) {
  const t = useExtracted();

  if (
    error?.kind === "authentication" ||
    error?.kind === "subscription" ||
    error?.kind === "unavailable" ||
    error?.kind === "slowDown"
  ) {
    return <RequestErrorMessage error={error} />;
  }

  return <>{t("We couldn't finish this answer.")}</>;
}

function useAnswerLinks({
  linksVerified,
  status,
}: {
  linksVerified: boolean;
  status: "pending" | "running" | "completed" | "failed";
}): TutorAnswerLinks | undefined {
  const { appLinks, linkComponent } = useLessonQuestionNavigation();
  const verified = linksVerified && status === "completed";

  return useMemo(
    () => (appLinks ? { Link: linkComponent, openBlock: appLinks.openBlock, verified } : undefined),
    [appLinks, linkComponent, verified],
  );
}

export function Thinking() {
  const t = useExtracted();

  return (
    <Marker role="status">
      <MarkerContent className="shimmer">
        {t({
          description: 'The study buddy is writing its answer; it speaks as "I".',
          message: "Thinking…",
        })}
      </MarkerContent>
    </Marker>
  );
}

export function QuestionAnswer({
  answer,
  checkAgainDisabled,
  disabled,
  error,
  isLocallyStreaming,
  linksVerified,
  onCheckAgain,
  onRetry,
  status,
}: {
  answer: string | null;
  checkAgainDisabled: boolean;
  disabled: boolean;
  error: LessonQuestionApiError | null;
  isLocallyStreaming: boolean;
  linksVerified: boolean;
  onCheckAgain: () => void;
  onRetry: () => void;
  status: "pending" | "running" | "completed" | "failed";
}) {
  const t = useExtracted();
  const limit = toHelpLimit(error);
  const appLinks = useAnswerLinks({ linksVerified, status });

  if (status === "pending" && !isLocallyStreaming) {
    return (
      <Button
        disabled={checkAgainDisabled}
        focusableWhenDisabled
        onClick={onRetry}
        size="sm"
        type="button"
        variant="outline"
      >
        {t("Get answer")}
      </Button>
    );
  }

  if (status === "failed") {
    return (
      <div className="flex flex-col items-start gap-3">
        {answer && (
          <LessonQuestionMarkdown
            answer={answer}
            appLinks={appLinks}
            isAnimating={false}
            isStreaming={false}
          />
        )}
        {limit ? (
          <p className="text-muted-foreground text-sm">{t("This one wasn't answered.")}</p>
        ) : (
          <>
            <p className="text-destructive-text text-sm">
              <AnswerFailureMessage error={error} />
            </p>
            <QuestionErrorAction disabled={disabled} error={error} onRetry={onRetry} />
          </>
        )}
      </div>
    );
  }

  if (answer) {
    return (
      <div className="flex flex-col items-start gap-3">
        <div className="text-foreground w-full min-w-0">
          <LessonQuestionMarkdown
            answer={answer}
            appLinks={appLinks}
            isAnimating={isLocallyStreaming}
            isStreaming={status === "running"}
          />
        </div>
        {status === "running" && !isLocallyStreaming && (
          <Button
            disabled={checkAgainDisabled}
            focusableWhenDisabled
            onClick={onCheckAgain}
            size="sm"
            type="button"
            variant="outline"
          >
            <RotateCcwIcon aria-hidden="true" />
            {t("Check again")}
          </Button>
        )}
      </div>
    );
  }

  if (status === "completed") {
    return <p className="text-muted-foreground">{t("No answer available.")}</p>;
  }

  return (
    <div className="flex flex-col items-start gap-3">
      <Thinking />
      {status === "running" && !isLocallyStreaming && (
        <Button
          disabled={checkAgainDisabled}
          focusableWhenDisabled
          onClick={onCheckAgain}
          size="sm"
          type="button"
          variant="outline"
        >
          <RotateCcwIcon aria-hidden="true" />
          {t("Check again")}
        </Button>
      )}
    </div>
  );
}
