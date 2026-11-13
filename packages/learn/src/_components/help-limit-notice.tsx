"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useExtracted } from "next-intl";
import { type ReactNode, useSyncExternalStore } from "react";
import { useFormatIsoDate } from "../_utils/iso-date";
import { type OpeningDay, toOpeningDay } from "../_utils/opening-day";
import { CreateAccountLink } from "./create-account-link";
import { GateWords, SubscribeAction } from "./subscribe-gate";

type SignUpRequired = { status: "signUpRequired" };

/** Without a `period`, the day's help is used up. */
export type HelpLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period?: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  | SignUpRequired;

/** A cap counted by the day, by the month or once in total. */
export type CalendarLimit =
  | { retryAfterSeconds: number; status: "slowDown" }
  | { period: "day" | "month" | "total"; status: "limitReached"; tier: EntitlementTier }
  | SignUpRequired;

/** The free plan's lessons come back one at a time: `availableAt` is the instant the next one opens. */
export type FreeLessonsUsed = {
  availableAt: string;
  period: "rolling30Days";
  status: "limitReached";
  tier: "free";
};

export type LessonLimit = CalendarLimit | FreeLessonsUsed;

/** `resource` says what ran out: the maps, the lessons a map writes first, or the day's AI spend. */
export type MindMapLimit = LessonLimit & {
  resource?: "aiSpend" | "generatedLessons" | "lessonStart" | "mindMap";
};

export type OutlineLimit = CalendarLimit;

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

/** What decides a notice's way on. */
type NoticeLimit =
  | { status: "signUpRequired" | "slowDown" }
  | { status: "limitReached"; tier: EntitlementTier };

export function needsAccount(limit: NoticeLimit): boolean {
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
}: LimitNoticeProps & { limit: NoticeLimit; words: LimitWords }) {
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
        <CreateAccountLink href={routes.signUp} />
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

function useHelpWords(kind?: HelpKind) {
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();
  const title = useHelpTitle(kind);

  return (limit: HelpLimit): LimitWords =>
    limit.status === "limitReached"
      ? { line: comesBack(limit), title: title(limit) }
      : refusal(limit);
}

export function useHelpLimitWords(limit: HelpLimit, kind?: HelpKind): LimitWords {
  return useHelpWords(kind)(limit);
}

type CapTitles = { day: string; guest: string; month: string };

/** Every cap reads the same way: a guest's title alone, otherwise the title and when it comes back. */
function useCapWords() {
  const refusal = useRefusalWords();
  const comesBack = useComesBackLine();

  return (limit: CalendarLimit, titles: CapTitles): LimitWords => {
    if (limit.status !== "limitReached") {
      return refusal(limit);
    }

    if (limit.tier === "guest") {
      return { title: titles.guest };
    }

    return { line: comesBack(limit), title: isMonthly(limit) ? titles.month : titles.day };
  };
}

function isFreeLessonsUsed(limit: LessonLimit): limit is FreeLessonsUsed {
  return limit.status === "limitReached" && limit.period === "rolling30Days";
}

// oxlint-disable-next-line no-empty-function -- useSyncExternalStore requires a subscribe that returns an unsubscribe
const subscribeToNothing = () => () => {};

/** The server doesn't know the learner's time zone, so it draws the day in UTC and the browser corrects it. */
function useOpeningDay(availableAt: string | null): OpeningDay | null {
  return useSyncExternalStore(
    subscribeToNothing,
    () => toOpeningDay({ availableAt, now: new Date(), timeZone: getLocalTimeZone() }),
    () => toOpeningDay({ availableAt, now: new Date(), timeZone: "UTC" }),
  );
}

function useNextFreeLessonLine() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();

  return (opensOn: OpeningDay | null): string | undefined => {
    if (!opensOn) {
      return undefined;
    }

    if (opensOn === "today") {
      return t("Your next free lesson opens later today, or subscribe to keep going.");
    }

    if (opensOn === "tomorrow") {
      return t("Your next free lesson opens tomorrow, or subscribe to keep going.");
    }

    return t({
      description:
        'On the screen a free learner sees when their free lessons are used. {date} is a day and its month, such as "November 22" in English.',
      message: "Your next free lesson opens on {date}, or subscribe to keep going.",
      values: { date: formatDate(opensOn, "dayMonth") },
    });
  };
}

export function useLessonLimitWords(limit: LessonLimit): LimitWords {
  const t = useExtracted();
  const capWords = useCapWords();
  const nextFreeLesson = useNextFreeLessonLine();
  const opensOn = useOpeningDay(isFreeLessonsUsed(limit) ? limit.availableAt : null);

  if (isFreeLessonsUsed(limit)) {
    return { line: nextFreeLesson(opensOn), title: t("You've used your free lessons") };
  }

  return capWords(limit, {
    day: t("No more new lessons today"),
    guest: t("No more lessons without an account"),
    month: t("No more new lessons this month"),
  });
}

function useMindMapRefusalWords(limit: MindMapLimit): LimitWords {
  const t = useExtracted();
  const helpWords = useHelpWords();
  const capWords = useCapWords();
  const lesson = useLessonLimitWords(limit);

  if (
    isFreeLessonsUsed(limit) ||
    limit.resource === "lessonStart" ||
    limit.resource === "generatedLessons"
  ) {
    return lesson;
  }

  if (limit.resource === "aiSpend") {
    return helpWords(limit);
  }

  return capWords(limit, {
    day: t("No more new mind maps today"),
    guest: t("No more mind maps without an account"),
    month: t("No more new mind maps this month"),
  });
}

function useOutlineLimitWords(limit: OutlineLimit): LimitWords {
  const t = useExtracted();
  const capWords = useCapWords();

  return capWords(limit, {
    day: t("No more previews today"),
    guest: t("No more previews without an account"),
    month: t("No more previews this month"),
  });
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

/** When a used-up cap comes back, for a screen or gate that draws its own way on. */
export function useCapLine(limit: CallLimit): string | undefined {
  const comesBack = useComesBackLine();
  return comesBack({ period: limit.period, status: "limitReached", tier: limit.tier });
}

/** Its screen's title says what ran out, so this is only the line and the way on. */
export function CallLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: CallLimit }) {
  const comesBack = useComesBackLine();
  const reached: ReachedLimit = { period: limit.period, status: "limitReached", tier: limit.tier };

  return <LimitNoticeBody {...props} limit={reached} words={{ line: comesBack(reached) }} />;
}
