"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";

/**
 * Why small AI help (an answer's explanation, grading a spoken answer, a plan edit in plain words)
 * isn't given now: fair use asks for a short break, or the plan's help for the day or the month
 * (`period`; the day's when unsaid) is used up.
 */
export type HelpLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period?: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier };

/**
 * Why a new lesson can't be written now: fair use asks for a short break, or the plan's cap for
 * the day, the month or (a guest's) for good is reached.
 */
export type LessonLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier };

/**
 * Why a new mind map isn't made now, with the same shape as a lesson's cap: fair use asks for a
 * short break, or the plan's maps for the day, the month or (a guest's) for good are made.
 */
export type MindMapLimit = LessonLimit;

/**
 * Why a speaking call can't start now: the plan's call time for today or this month is used, or
 * (`total`) a guest's plan has no calls.
 */
export type CallLimit = { period: "day" | "month" | "total"; tier: EntitlementTier };

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

/** Why the help didn't come, in one sentence, for screens that show it without a link. */
export function useHelpLimitMessage(limit: HelpLimit): string {
  const t = useExtracted();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  const thisMonth = limit.period === "month" || limit.period === "total";

  if (limit.tier === "guest") {
    return thisMonth
      ? t(
          "You've used the free help you can get without an account. Create a free account to keep going.",
        )
      : t("You've used today's free help. Create a free account to keep going.");
  }

  if (limit.tier === "plus") {
    return t("You've used today's help. It comes back tomorrow.");
  }

  return thisMonth
    ? t("You've used this month's help. It comes back next month, or get Plus to keep going now.")
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

function useMindMapLimitMessage(limit: MindMapLimit): string {
  const t = useExtracted();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.tier === "guest") {
    return t(
      "You've made the mind map you can try without an account. Create a free account to make more.",
    );
  }

  if (limit.tier === "plus") {
    return t("That's all the new mind maps for today. You can make more tomorrow.");
  }

  return limit.period === "month"
    ? t(
        "That's all the new mind maps for this month. You can make more next month, or get Plus to keep going now.",
      )
    : t(
        "That's all the new mind maps for today. You can make more tomorrow, or get Plus to keep going now.",
      );
}

function useCallLimitMessage(limit: CallLimit): string {
  const t = useExtracted();

  if (limit.tier === "guest") {
    return t("Speaking calls come with a free account. Create one to practice out loud.");
  }

  if (limit.tier === "plus") {
    return limit.period === "month"
      ? t("Your calls come back next month.")
      : t("Your calls come back tomorrow.");
  }

  return limit.period === "month"
    ? t("Your calls come back next month, or get Plus for higher call limits.")
    : t("Your calls come back tomorrow, or get Plus for higher call limits.");
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

/**
 * Says why a new mind map isn't made, the same way: a guest creates a free account, a free learner
 * makes more when their cap starts over or gets Plus now, and Plus tomorrow. Maps that already
 * exist never count.
 */
export function MindMapLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { limit: MindMapLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useMindMapLimitMessage(limit)} />;
}

/**
 * Says why a speaking call can't start, the same way: a guest creates a free account, a free
 * learner gets calls back the next day or month or gets Plus's higher call limits now, and Plus
 * waits. Never how much call time a plan has.
 */
export function CallLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: CallLimit }) {
  return (
    <LimitNoticeBody
      {...props}
      limit={{ status: "limitReached", tier: limit.tier }}
      message={useCallLimitMessage(limit)}
    />
  );
}
