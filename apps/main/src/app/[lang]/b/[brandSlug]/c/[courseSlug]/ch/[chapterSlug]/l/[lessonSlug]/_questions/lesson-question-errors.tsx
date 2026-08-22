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
    return <>{t("Your session expired. Sign in again to keep asking questions.")}</>;
  }

  if (error?.kind === "subscription") {
    return <>{t("Questions are not available for this lesson with your current plan.")}</>;
  }

  if (error?.kind === "unavailable") {
    return <>{t("This lesson is no longer available.")}</>;
  }

  if (error?.kind === "invalid") {
    return <>{t("This question cannot be sent from the current lesson context.")}</>;
  }

  if (error?.kind === "limit") {
    return (
      <>
        {t(
          "{period, select, day {You've reached today's question limit.} month {You've reached this month's question limit.} other {You've reached the question limit.}} You can keep learning and review saved answers.",
          { period: error.limit.period },
        )}
      </>
    );
  }

  return <>{t("Something went wrong. Please try again.")}</>;
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
