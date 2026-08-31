"use client";

import { GenerationLimitAction } from "@/components/generation/generation-limit-cta";
import { type AppRoute, Link } from "@/i18n/navigation";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { RotateCcwIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type LessonQuestionApiError } from "./lesson-question-api";

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

  if (error?.kind === "limit") {
    return (
      <>
        {t(
          "{period, select, day {You've reached today's question limit. Try again tomorrow.} month {You've reached this month's question limit. Try again next month.} other {You've reached your question limit.}}",
          { period: error.limit.period },
        )}
      </>
    );
  }

  return <>{t("Something went wrong. Try again.")}</>;
}

export function QuestionErrorAction<Href extends string>({
  className,
  disabled = false,
  error,
  loginHref,
  onRetry,
}: {
  className?: string;
  disabled?: boolean;
  error: LessonQuestionApiError | null;
  loginHref: AppRoute<Href>;
  onRetry: () => void;
}) {
  const t = useExtracted();

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
      <Link className={buttonVariants({ className, variant: "outline" })} href="/subscription">
        {t("View plans")}
      </Link>
    );
  }

  if (error?.kind === "limit") {
    return (
      <GenerationLimitAction
        className={className}
        loginHref={loginHref}
        variant="outline"
        viewer={error.limit.viewer}
      />
    );
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
