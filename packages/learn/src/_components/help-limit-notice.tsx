"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";

/**
 * Why small AI help (a simpler version, an answer's explanation, grading a spoken answer, a plan
 * edit in plain words) isn't given now: fair use asks for a short break, or today's is used up.
 */
export type HelpLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "limitReached"; tier: EntitlementTier };

/**
 * Why a new lesson can't be written now: fair use asks for a short break, or the plan's cap for
 * the day, the month or (a guest's) for good is reached.
 */
export type LessonLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier };

type LimitLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

type LimitNoticeProps = {
  className?: string;
  linkComponent: LimitLink;
  routes: { signUp: string; upgrade: string };
};

const TEXT_CLASS = "text-muted-foreground text-sm text-pretty";

/**
 * The one thing to do about a cap: a guest creates a free account, a free learner gets Plus. Plus
 * and fair use have nothing to do but wait, so the message stands alone.
 */
function LimitNoticeBody({
  className,
  limit,
  linkComponent: LinkComponent,
  message,
  routes,
}: LimitNoticeProps & { limit: HelpLimit; message: string }) {
  const t = useExtracted();
  const action = buttonVariants({ size: "sm", variant: "outline" });

  if (limit.status === "slowDown" || limit.tier === "plus") {
    return <p className={cn(TEXT_CLASS, className)}>{message}</p>;
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className={TEXT_CLASS}>{message}</p>

      {limit.tier === "guest" ? (
        <LinkComponent className={action} href={routes.signUp}>
          {t("Create a free account")}
        </LinkComponent>
      ) : (
        <LinkComponent className={action} href={routes.upgrade}>
          {t("See Plus")}
        </LinkComponent>
      )}
    </div>
  );
}

function useHelpLimitMessage(limit: HelpLimit): string {
  const t = useExtracted();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.tier === "guest") {
    return t("You've used today's free help. Create a free account to keep going.");
  }

  return limit.tier === "plus"
    ? t("You've used today's help. It comes back tomorrow.")
    : t("You've used today's help. It comes back tomorrow, or get Plus to keep going now.");
}

function useLessonLimitMessage(limit: LessonLimit): string {
  const t = useExtracted();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.tier === "guest") {
    return t(
      "You've taken the lessons you can try without an account. Create a free account to keep going.",
    );
  }

  if (limit.tier === "plus") {
    return t("That's all the new lessons for today. They open again tomorrow.");
  }

  return limit.period === "month"
    ? t(
        "That's all the new lessons for this month. They open again next month, or get Plus to keep going now.",
      )
    : t(
        "That's all the new lessons for today. They open again tomorrow, or get Plus to keep going now.",
      );
}

/**
 * Says why the help didn't come, with the one thing to do about it: a guest creates a free account
 * to keep going, a free learner gets it back tomorrow or gets Plus now, and Plus gets it back
 * tomorrow. Hosts pass their own link and routes, so the lesson player and learn screens share it.
 */
export function HelpLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: HelpLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useHelpLimitMessage(limit)} />;
}

/**
 * Says why a new lesson isn't written now, the same way: a guest creates a free account, a free
 * learner gets new lessons back when their cap starts over or gets Plus now, and Plus tomorrow.
 */
export function LessonLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: LessonLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useLessonLimitMessage(limit)} />;
}
