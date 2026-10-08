"use client";

import { Link } from "@/i18n/navigation";
import { useGoalLimitMessage } from "@zoonk/learn/onboarding/goal-errors";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { START_FAILURE_SLOT } from "./public-start";
import { type CourseStartFailure } from "./use-course-start";

type CourseStartRemedy = "signUp" | "upgrade" | "retry" | null;

/**
 * The one thing to do next: an account, Plus, or another try. A limit that only needs time (the
 * day's goals, too many at once) has none.
 */
function getCourseStartRemedy(failure: CourseStartFailure): CourseStartRemedy {
  if (failure.status !== "limitReached") {
    return "retry";
  }

  if (failure.reason === "guest") {
    return "signUp";
  }

  return failure.reason === "oneActiveGoal" ? "upgrade" : null;
}

/**
 * Whether the start can only go on with an account or Plus: then that's the page's one action,
 * in place of a start that would be refused again.
 */
export function isStartBlocked(failure: CourseStartFailure | null): boolean {
  const remedy = failure ? getCourseStartRemedy(failure) : null;
  return remedy === "signUp" || remedy === "upgrade";
}

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
  const remedy = getCourseStartRemedy(failure);

  if (remedy === "signUp") {
    return (
      <Link className={className} href="/login" prefetch={false}>
        {t("Create a free account")}
      </Link>
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
