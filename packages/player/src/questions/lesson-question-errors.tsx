"use client";

import {
  type HelpLimit,
  HelpLimitNotice,
  useHelpLimitWords,
  useLiveLimit,
} from "@zoonk/learn/help-limit";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { type LessonQuestionState } from "./lesson-question-state";
import { getQuestionRefusal } from "./lesson-question-state-helpers";

export function toHelpLimit(error: LessonQuestionApiError | null): HelpLimit | null {
  if (error?.kind === "signUpRequired") {
    return { status: "signUpRequired" };
  }

  if (error?.kind === "slowDown") {
    return { retryAfterSeconds: error.retryAfterSeconds, status: "slowDown" };
  }

  if (error?.kind === "usageLimit") {
    return error.period === "rolling30Days"
      ? {
          availableAt: error.availableAt ?? null,
          period: error.period,
          receivedAt: error.receivedAt,
          status: "limitReached",
          tier: error.tier,
        }
      : { period: error.period, status: "limitReached", tier: error.tier };
  }

  return null;
}

/** The limit that stops asking while it holds; once it lifts, the learner can ask again. */
export function useQuestionLimit(
  state: Pick<LessonQuestionState, "answerError" | "error" | "requestError">,
): HelpLimit | null {
  return toHelpLimit(useLiveLimit(getQuestionRefusal(state)));
}

export function QuestionLimitNotice({
  className,
  limit,
}: {
  className?: string;
  limit: HelpLimit;
}) {
  const { linkComponent, loginHref, subscriptionHref } = useLessonQuestionNavigation();

  return (
    <HelpLimitNotice
      className={className}
      kind="messages"
      limit={limit}
      linkComponent={linkComponent}
      routes={{ signUp: loginHref, upgrade: subscriptionHref }}
    />
  );
}

export function RequestErrorMessage({ error }: { error: LessonQuestionApiError | null }) {
  const t = useExtracted();

  if (error?.kind === "authentication") {
    return <>{t("You've been logged out.")}</>;
  }

  if (error?.kind === "subscription") {
    return <>{t("Asking questions needs a subscription")}</>;
  }

  if (error?.kind === "unavailable") {
    return <>{t("This lesson is no longer available.")}</>;
  }

  if (error?.kind === "invalid") {
    return <>{t("We couldn't send this question. Try again.")}</>;
  }

  const limit = toHelpLimit(error);

  if (limit) {
    return <HelpLimitMessage limit={limit} />;
  }

  return <>{t("Something went wrong. Try again.")}</>;
}

function HelpLimitMessage({ limit }: { limit: HelpLimit }) {
  const { line, title } = useHelpLimitWords(limit, "messages");
  return title ?? line;
}

export function QuestionErrorAction({
  className,
  disabled = false,
  error,
  onRetry,
}: {
  className?: string;
  disabled?: boolean;
  error: LessonQuestionApiError | null;
  onRetry: () => void;
}) {
  const t = useExtracted();

  const { linkComponent: Link, loginHref, subscriptionHref } = useLessonQuestionNavigation();

  if (error?.kind === "authentication") {
    return (
      <a className={buttonVariants({ className, variant: "outline" })} href={loginHref}>
        {t("Log in")}
      </a>
    );
  }

  if (error?.kind === "subscription") {
    return (
      <Link className={buttonVariants({ className, variant: "outline" })} href={subscriptionHref}>
        {t("Subscribe")}
      </Link>
    );
  }

  if (toHelpLimit(error)) {
    return null;
  }

  if (error?.kind === "unavailable") {
    return null;
  }

  return <TryAgainButton className={className} disabled={disabled} onRetry={onRetry} />;
}

export function TryAgainButton({
  className,
  disabled = false,
  onRetry,
}: {
  className?: string;
  disabled?: boolean;
  onRetry: () => void;
}) {
  const t = useExtracted();

  return (
    <Button
      className={className}
      disabled={disabled}
      focusableWhenDisabled
      onClick={onRetry}
      type="button"
      variant="outline"
    >
      <RotateCcwIcon aria-hidden="true" />
      {t("Try again")}
    </Button>
  );
}
