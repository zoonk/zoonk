"use client";

import { Link, getPathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";
import { useGoalLimitText } from "@zoonk/learn/onboarding/goal-errors";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { getCourseStartRemedy } from "./course-start-remedy";
import { START_FAILURE_SLOT } from "./public-start";
import { type CourseStartFailure } from "./use-course-start";

/** In a bar's action row the main action comes last, so "Go to your Plan" comes before Subscribe. */
export function CourseStartFailureAction({
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
  const locale = useAppLocale();
  const remedy = getCourseStartRemedy(failure);

  if (remedy === "signUp") {
    return (
      <PendingLink
        className={className}
        href={getPathname({ href: "/login", locale })}
        icon={<UserPlusIcon aria-hidden="true" />}
      >
        {t("Create a free account")}
      </PendingLink>
    );
  }

  if (remedy === "subscribe" || remedy === "upgrade") {
    return (
      <>
        {remedy === "upgrade" && (
          <Link className={secondaryClassName} href="/plan" prefetch>
            {t("Go to your Plan")}
          </Link>
        )}
        <Link className={className} href="/subscription" prefetch={false}>
          {t("Subscribe")}
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
  withAction = true,
}: {
  actionClassName?: string;
  className?: string;
  failure: CourseStartFailure | null;
  onRetry: () => void;
  secondaryActionClassName?: string;
  /** False where the screen's bar shows `CourseStartFailureAction` in its main action's place. */
  withAction?: boolean;
}) {
  const t = useExtracted();
  const limitText = useGoalLimitText(failure?.status === "limitReached" ? failure : null);

  if (!failure) {
    return null;
  }

  return (
    <div
      className={cn("flex max-w-md flex-col items-start gap-3", className)}
      data-slot={START_FAILURE_SLOT}
      role="alert"
    >
      <p
        className={cn("text-muted-foreground text-sm text-pretty", limitText.hidden && "invisible")}
      >
        {failure.status === "limitReached" ? limitText.text : t("We couldn't start this course.")}
      </p>

      {withAction && (
        <CourseStartFailureAction
          className={actionClassName ?? buttonVariants({ variant: "outline" })}
          failure={failure}
          onRetry={onRetry}
          secondaryClassName={secondaryActionClassName ?? buttonVariants({ variant: "outline" })}
        />
      )}
    </div>
  );
}
