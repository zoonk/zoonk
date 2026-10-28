"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";

type SignUpRequired = { status: "signUpRequired" };

/** Without a `period`, the day's help is used up. */
export type HelpLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period?: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  | SignUpRequired;

export type LessonLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  | SignUpRequired;

export type MindMapLimit = LessonLimit;

export type OutlineLimit = LessonLimit;

export type CallLimit = { period: "day" | "month" | "total"; tier: EntitlementTier };

type LimitLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

type LimitNoticeProps = {
  className?: string;
  linkComponent: LimitLink;
  routes: { signUp: string; upgrade: string };
};

const TEXT_CLASS = "text-muted-foreground text-sm text-pretty";

export function needsAccount(limit: HelpLimit): boolean {
  return (
    limit.status === "signUpRequired" || (limit.status === "limitReached" && limit.tier === "guest")
  );
}

function LimitNoticeBody({
  className,
  limit,
  linkComponent: LinkComponent,
  message,
  routes,
}: LimitNoticeProps & { limit: HelpLimit; message: string }) {
  const t = useExtracted();
  const action = buttonVariants({ size: "sm", variant: "outline" });

  if (limit.status === "slowDown" || (limit.status === "limitReached" && limit.tier === "plus")) {
    return <p className={cn(TEXT_CLASS, className)}>{message}</p>;
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <p className={TEXT_CLASS}>{message}</p>

      {needsAccount(limit) ? (
        <a className={action} href={routes.signUp}>
          {t("Create a free account")}
        </a>
      ) : (
        <LinkComponent className={action} href={routes.upgrade}>
          {t("See Plus")}
        </LinkComponent>
      )}
    </div>
  );
}

function useSignUpRequiredMessage(): string {
  const t = useExtracted();
  return t("Create your free account to continue.");
}

export function useHelpLimitMessage(limit: HelpLimit): string {
  const t = useExtracted();
  const signUpRequired = useSignUpRequiredMessage();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.status === "signUpRequired") {
    return signUpRequired;
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
  const signUpRequired = useSignUpRequiredMessage();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.status === "signUpRequired") {
    return signUpRequired;
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
  const signUpRequired = useSignUpRequiredMessage();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.status === "signUpRequired") {
    return signUpRequired;
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

function useOutlineLimitMessage(limit: OutlineLimit): string {
  const t = useExtracted();
  const signUpRequired = useSignUpRequiredMessage();

  if (limit.status === "slowDown") {
    return t("Take a short break, then try again.");
  }

  if (limit.status === "signUpRequired") {
    return signUpRequired;
  }

  if (limit.tier === "guest") {
    return t(
      "You've seen the topic you can see ahead of time without an account. Create a free account to see more.",
    );
  }

  if (limit.tier === "plus") {
    return t("That's all the topics you can see ahead of time today. You can see more tomorrow.");
  }

  return limit.period === "month"
    ? t(
        "That's all the topics you can see ahead of time this month. You can see more next month, or get Plus to keep going now.",
      )
    : t(
        "That's all the topics you can see ahead of time today. You can see more tomorrow, or get Plus to keep going now.",
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

export function HelpLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: HelpLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useHelpLimitMessage(limit)} />;
}

export function LessonLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: LessonLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useLessonLimitMessage(limit)} />;
}

export function MindMapLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { limit: MindMapLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useMindMapLimitMessage(limit)} />;
}

export function OutlineLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { limit: OutlineLimit }) {
  return <LimitNoticeBody {...props} limit={limit} message={useOutlineLimitMessage(limit)} />;
}

/** Never says how much call time a plan has. */
export function CallLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: CallLimit }) {
  return (
    <LimitNoticeBody
      {...props}
      limit={{ status: "limitReached", tier: limit.tier }}
      message={useCallLimitMessage(limit)}
    />
  );
}
