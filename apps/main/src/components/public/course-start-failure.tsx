"use client";

import { Link, getPathname } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";
import { ONBOARDING_ACTION_LINK_CLASS } from "@zoonk/learn/onboarding/frame";
import { useGoalLimitText } from "@zoonk/learn/onboarding/goal-errors";
import { SignUpMainAction, SubscribeMainAction } from "@zoonk/learn/subscribe-gate";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
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
        <Link className={className} href="/subscription" prefetch={false}>
          {t("Subscribe")}
        </Link>
        {remedy === "upgrade" && (
          <Link className={secondaryClassName} href="/plan" prefetch>
            {t("Go to your Plan")}
          </Link>
        )}
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

      <div className="flex flex-wrap gap-2 empty:hidden">
        <FailureAction
          className={actionClassName ?? buttonVariants({ variant: "outline" })}
          failure={failure}
          onRetry={onRetry}
          secondaryClassName={secondaryActionClassName ?? buttonVariants({ variant: "outline" })}
        />
      </div>
    </div>
  );
}

export function CourseStartBlockedAction({ failure }: { failure: CourseStartFailure }) {
  const t = useExtracted();

  if (getCourseStartRemedy(failure) === "signUp") {
    return <SignUpMainAction />;
  }

  return (
    <SubscribeMainAction
      action={
        getCourseStartRemedy(failure) === "upgrade" && (
          <Link className={ONBOARDING_ACTION_LINK_CLASS.other} href="/plan" prefetch>
            {t("Go to your Plan")}
          </Link>
        )
      }
    />
  );
}
