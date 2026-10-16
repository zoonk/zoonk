"use client";

import { Link, getPathname } from "@/i18n/navigation";
import { useGoalLimitMessage } from "@zoonk/learn/onboarding/goal-errors";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted, useLocale } from "next-intl";
import { getCourseStartRemedy } from "./course-start-remedy";
import { START_FAILURE_SLOT } from "./public-start";
import { type CourseStartFailure } from "./use-course-start";

function FailureAction({
  className,
  failure,
  onRetry,
}: {
  className: string;
  failure: CourseStartFailure;
  onRetry: () => void;
}) {
  const t = useExtracted();
  const locale = useLocale();
  const remedy = getCourseStartRemedy(failure);

  if (remedy === "signUp") {
    return (
      <a className={className} href={getPathname({ href: "/login", locale })}>
        {t("Create a free account")}
      </a>
    );
  }

  if (remedy === "upgrade") {
    return (
      <Link className={className} href="/subscription" prefetch={false}>
        {t("Get Plus")}
      </Link>
    );
  }

  if (!remedy) {
    return null;
  }

  return (
    <button className={className} onClick={onRetry} type="button">
      {t("Try again")}
    </button>
  );
}

/**
 * Why a course didn't start, where the learner pressed start: a goal limit in onboarding's words
 * with what they can do about it, or a failure with another try.
 */
export function CourseStartFailureNote({
  actionClassName,
  announce = true,
  className,
  failure,
  onRetry,
}: {
  /** The action's look where the note sits; an outline button by default. */
  actionClassName?: string;
  /**
   * Whether screen readers hear it as it appears: only where the start was pressed, when a page
   * repeats the note under each of its start controls.
   */
  announce?: boolean;
  className?: string;
  failure: CourseStartFailure | null;
  onRetry: () => void;
}) {
  const t = useExtracted();
  const limitMessage = useGoalLimitMessage();

  if (!failure) {
    return null;
  }

  return (
    <div
      className={cn("flex max-w-md flex-col items-start gap-3", className)}
      data-slot={START_FAILURE_SLOT}
      role={announce ? "alert" : undefined}
    >
      <p className="text-muted-foreground text-sm text-pretty">
        {failure.status === "limitReached"
          ? limitMessage(failure.reason)
          : t("We couldn't start this course.")}
      </p>

      <FailureAction
        className={actionClassName ?? buttonVariants({ variant: "outline" })}
        failure={failure}
        onRetry={onRetry}
      />
    </div>
  );
}
