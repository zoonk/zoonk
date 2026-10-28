"use client";

import { type HelpLimit, HelpLimitNotice, useHelpLimitMessage } from "@zoonk/learn/help-limit";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";
import { type LessonQuestionState } from "./lesson-question-state";

export function toHelpLimit(error: LessonQuestionApiError | null): HelpLimit | null {
  if (error?.kind === "signUpRequired") {
    return { status: "signUpRequired" };
  }

  if (error?.kind === "usageLimit") {
    return { period: error.period, status: "limitReached", tier: error.tier };
  }

  return null;
}

export function getQuestionLimit(
  state: Pick<LessonQuestionState, "answerError" | "error" | "requestError">,
): HelpLimit | null {
  const refusedQuestion = state.error === "create" ? toHelpLimit(state.requestError) : null;
  return refusedQuestion ?? toHelpLimit(state.answerError?.reason ?? null);
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
      limit={limit}
      linkComponent={linkComponent}
      routes={{ signUp: loginHref, upgrade: subscriptionHref }}
    />
  );
}

export function RequestErrorMessage({ error }: { error: LessonQuestionApiError | null }) {
  const t = useExtracted();

  if (error?.kind === "authentication") {
    return <>{t("Your session expired. Sign in again.")}</>;
  }

  if (error?.kind === "subscription") {
    return <>{t("Subscribe to ask questions")}</>;
  }

  if (error?.kind === "unavailable") {
    return <>{t("This lesson is no longer available.")}</>;
  }

  if (error?.kind === "invalid") {
    return <>{t("We couldn't send this question. Try again.")}</>;
  }

  if (error?.kind === "slowDown") {
    return <>{t("Take a short break, then ask again.")}</>;
  }

  const limit = toHelpLimit(error);

  if (limit) {
    return <HelpLimitMessage limit={limit} />;
  }

  return <>{t("Something went wrong. Try again.")}</>;
}

function HelpLimitMessage({ limit }: { limit: HelpLimit }) {
  return <>{useHelpLimitMessage(limit)}</>;
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
      <Link
        className={buttonVariants({ className, variant: "outline" })}
        href={loginHref}
        prefetch={false}
      >
        {t("Sign in")}
      </Link>
    );
  }

  if (error?.kind === "subscription") {
    return (
      <Link className={buttonVariants({ className, variant: "outline" })} href={subscriptionHref}>
        {t("View plans")}
      </Link>
    );
  }

  if (toHelpLimit(error)) {
    return null;
  }

  if (error?.kind === "unavailable") {
    return null;
  }

  return (
    <Button
      className={className}
      disabled={disabled}
      onClick={onRetry}
      type="button"
      variant="outline"
    >
      <RotateCcwIcon aria-hidden="true" />
      {t("Try again")}
    </Button>
  );
}
