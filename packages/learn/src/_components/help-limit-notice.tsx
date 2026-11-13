"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { PendingLink } from "@zoonk/ui/patterns/links/pending";
import { UserPlusIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import { GateWords, SubscribeAction } from "./subscribe-gate";

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

/** `resource` says what ran out: the maps, the lessons a map writes first, or the day's AI spend. */
export type MindMapLimit = LessonLimit & {
  resource?: "aiSpend" | "generatedLessons" | "lessonStart" | "mindMap";
};

export type OutlineLimit = LessonLimit;

export type CallLimit = { period: "day" | "month" | "total"; tier: EntitlementTier };

type LimitLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

type LimitNoticeProps = {
  className?: string;
  linkComponent: LimitLink;
  routes: { signUp: string; upgrade: string };
};

/** What ran out as the title, and when it comes back as the one line under it. */
type LimitWords = { line?: string; title?: string };

/** What the learner asked for when the day's help ran out; without it the notice names no kind. */
export type HelpKind = "explanations" | "messages";

export function needsAccount(limit: HelpLimit): boolean {
  return (
    limit.status === "signUpRequired" || (limit.status === "limitReached" && limit.tier === "guest")
  );
}

function LimitNoticeBody({
  className,
  limit,
  linkComponent: LinkComponent,
  routes,
  words,
}: LimitNoticeProps & { limit: HelpLimit; words: LimitWords }) {
  const t = useExtracted();

  if (limit.status === "slowDown" || (limit.status === "limitReached" && limit.tier === "plus")) {
    return (
      <div className={className}>
        <GateWords {...words} />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <GateWords {...words} />

      {needsAccount(limit) ? (
        <PendingLink
          className={buttonVariants({ size: "sm", variant: "outline" })}
          href={routes.signUp}
          icon={<UserPlusIcon aria-hidden="true" />}
        >
          {t("Create a free account")}
        </PendingLink>
      ) : (
        <SubscribeAction href={routes.upgrade} link={LinkComponent} />
      )}
    </div>
  );
}

type ReachedLimit = Extract<HelpLimit, { status: "limitReached" }>;

function isMonthly(limit: ReachedLimit): boolean {
  return limit.period === "month" || limit.period === "total";
}

/** A guest's way on is the button, so their notice has no line. */
function useComesBackLine() {
  const t = useExtracted();

  return (limit: ReachedLimit): string | undefined => {
    if (limit.tier === "guest") {
      return undefined;
    }

    if (limit.tier === "plus") {
      return isMonthly(limit) ? t("More next month.") : t("More tomorrow.");
    }

    return isMonthly(limit)
      ? t("More next month, or subscribe to keep going.")
      : t("More tomorrow, or subscribe to keep going.");
  };
}

function useRefusalWords() {
  const t = useExtracted();

  return (limit: Exclude<HelpLimit, ReachedLimit>): LimitWords =>
    limit.status === "slowDown"
      ? { line: t("Take a short break, then try again.") }
      : { title: t("This needs a free account") };
}

function useHelpTitle(kind: HelpKind | undefined) {
  const t = useExtracted();

  return (limit: ReachedLimit): string => {
    if (limit.tier === "guest") {
      return t("That's all you can try without an account");
    }

    if (kind === "messages") {
      return isMonthly(limit) ? t("No more messages this month") : t("No more messages today");
    }

    if (kind === "explanations") {
      return isMonthly(limit)
        ? t("No more explanations this month")
        : t("No more explanations today");
    }

    return isMonthly(limit)
      ? t("You've reached this month's limit")
      : t("You've reached today's limit");
  };
}

export function useHelpLimitWords(limit: HelpLimit, kind?: HelpKind): LimitWords {
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();
  const title = useHelpTitle(kind);

  return limit.status === "limitReached"
    ? { line: comesBack(limit), title: title(limit) }
    : refusal(limit);
}

/** A free learner's month of lessons is the plan's one allowance, so its title says so. */
export function useLessonLimitWords(limit: LessonLimit): LimitWords {
  const t = useExtracted();
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();

  if (limit.status !== "limitReached") {
    return refusal(limit);
  }

  if (limit.tier === "guest") {
    return { title: t("No more lessons without an account") };
  }

  if (limit.tier === "free" && isMonthly(limit)) {
    return { line: comesBack(limit), title: t("You've used this month's free lessons") };
  }

  return {
    line: comesBack(limit),
    title: isMonthly(limit) ? t("No more new lessons this month") : t("No more new lessons today"),
  };
}

function useMindMapLimitWords(limit: MindMapLimit): LimitWords {
  const t = useExtracted();
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();

  if (limit.status !== "limitReached") {
    return refusal(limit);
  }

  if (limit.tier === "guest") {
    return { title: t("No more mind maps without an account") };
  }

  return {
    line: comesBack(limit),
    title: isMonthly(limit)
      ? t("No more new mind maps this month")
      : t("No more new mind maps today"),
  };
}

function useMindMapRefusalWords(limit: MindMapLimit): LimitWords {
  const help = useHelpLimitWords(limit);
  const lesson = useLessonLimitWords(limit);
  const map = useMindMapLimitWords(limit);

  if (limit.resource === "aiSpend") {
    return help;
  }

  return limit.resource === "lessonStart" || limit.resource === "generatedLessons" ? lesson : map;
}

function useOutlineLimitWords(limit: OutlineLimit): LimitWords {
  const t = useExtracted();
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();

  if (limit.status !== "limitReached") {
    return refusal(limit);
  }

  if (limit.tier === "guest") {
    return { title: t("No more previews without an account") };
  }

  return {
    line: comesBack(limit),
    title: isMonthly(limit) ? t("No more previews this month") : t("No more previews today"),
  };
}

export function HelpLimitNotice({
  kind,
  limit,
  ...props
}: LimitNoticeProps & { kind?: HelpKind; limit: HelpLimit }) {
  return <LimitNoticeBody {...props} limit={limit} words={useHelpLimitWords(limit, kind)} />;
}

export function LessonLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: LessonLimit }) {
  return <LimitNoticeBody {...props} limit={limit} words={useLessonLimitWords(limit)} />;
}

export function MindMapLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { limit: MindMapLimit }) {
  return <LimitNoticeBody {...props} limit={limit} words={useMindMapRefusalWords(limit)} />;
}

export function OutlineLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { limit: OutlineLimit }) {
  return <LimitNoticeBody {...props} limit={limit} words={useOutlineLimitWords(limit)} />;
}

/** When a learner's calls come back, for a screen that draws its own way on. */
export function useCallLimitLine(limit: CallLimit): string | undefined {
  const comesBack = useComesBackLine();
  return comesBack({ period: limit.period, status: "limitReached", tier: limit.tier });
}

/** Its screen's title says what ran out, so this is only the line and the way on. */
export function CallLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: CallLimit }) {
  const comesBack = useComesBackLine();
  const reached: ReachedLimit = { period: limit.period, status: "limitReached", tier: limit.tier };

  return <LimitNoticeBody {...props} limit={reached} words={{ line: comesBack(reached) }} />;
}
