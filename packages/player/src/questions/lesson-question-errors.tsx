"use client";

import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";
import { useLessonQuestionNavigation } from "./lesson-question-navigation";

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

  if (error?.kind === "usageLimit") {
    return <UsageLimitMessage period={error.period} tier={error.tier} />;
  }

  return <>{t("Something went wrong. Try again.")}</>;
}

function UsageLimitMessage({
  period,
  tier,
}: Pick<Extract<LessonQuestionApiError, { kind: "usageLimit" }>, "period" | "tier">) {
  const t = useExtracted();

  if (tier === "guest") {
    return <>{t("Create a free account to ask the tutor.")}</>;
  }

  return (
    <>
      {t(
        "{period, select, day {You've asked all of today's questions. Ask again tomorrow.} month {You've asked all of this month's questions. Ask again next month.} other {You've asked all your questions.}}",
        { period },
      )}
    </>
  );
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

  if (error?.kind === "usageLimit" && error.tier === "guest") {
    return (
      <Link
        className={buttonVariants({ className, variant: "outline" })}
        href={loginHref}
        prefetch={false}
      >
        {t("Create account")}
      </Link>
    );
  }

  if (error?.kind === "usageLimit" && error.tier === "free") {
    return (
      <Link className={buttonVariants({ className, variant: "outline" })} href={subscriptionHref}>
        {t("View plans")}
      </Link>
    );
  }

  if (error?.kind === "usageLimit") {
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
