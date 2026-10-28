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
  secondaryClassName,
}: {
  className: string;
  failure: CourseStartFailure;
  onRetry: () => void;
  secondaryClassName: string;
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
      <>
        <Link className={className} href="/subscription" prefetch={false}>
          {t("See Plus")}
        </Link>
        <Link className={secondaryClassName} href="/plan" prefetch>
          {t("Go to your Plan")}
        </Link>
      </>
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

export function CourseStartFailureNote({
  actionClassName,
  className,
  failure,
  onRetry,
  secondaryActionClassName,
}: {
  actionClassName?: string;
  className?: string;
  failure: CourseStartFailure | null;
  onRetry: () => void;
  secondaryActionClassName?: string;
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
      role="alert"
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
        secondaryClassName={secondaryActionClassName ?? buttonVariants({ variant: "outline" })}
      />
    </div>
  );
}
