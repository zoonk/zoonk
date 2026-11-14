"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  isRollingCap,
  useComesBackLine,
  useMapLessonsWords,
  useOpeningDay,
} from "./comes-back-words";
import { CreateAccountLink } from "./create-account-link";
import {
  GateWords,
  SignUpMainAction,
  SubscribeAction,
  SubscribeMainAction,
} from "./subscribe-gate";

/** A refusal lasts until its instant: then the action it took the place of is back, and the server decides again. */
export function useLiveLimit<Limit extends object>(limit: Limit | null): Limit | null {
  const availableAt =
    limit && "availableAt" in limit && typeof limit.availableAt === "string"
      ? limit.availableAt
      : null;

  return useOpeningDay(availableAt) === "open" ? null : limit;
}

type SignUpRequired = { status: "signUpRequired" };

type SlowDown = { retryAfterSeconds: number; status: "slowDown" };

/**
 * A cap counted over the last 30 days, the rule for every monthly cap: each use comes back 30 days
 * after it was made, and `availableAt` is the instant the next one does. Its words say "a month".
 */
type RollingCap = {
  availableAt: string | null;
  period: "rolling30Days";
  status: "limitReached";
  tier: EntitlementTier;
};

/** A cap counted by the day, or once in total (a guest's). Without a `period`, the day's help is used up. */
type FixedCap = { period?: "day" | "total"; status: "limitReached"; tier: EntitlementTier };

export type HelpLimit = SlowDown | FixedCap | RollingCap | SignUpRequired;

/** Only a free learner's lessons are counted over the last 30 days. */
export type FreeLessonsUsed = RollingCap;

/** Any other new lesson stops for the day (the day's AI budget), or for a guest until they make an account. */
type LessonCap = { status: "limitReached"; tier: EntitlementTier };

export type LessonLimit = SlowDown | LessonCap | SignUpRequired | FreeLessonsUsed;

/** `resource` says what ran out: the maps, the lessons a map writes first, or the day's AI spend. */
export type MindMapLimit = HelpLimit & {
  resource?: "aiSpend" | "chapterLessons" | "generatedLessons" | "lessonStart" | "mindMap";
};

export type OutlineLimit = HelpLimit;

export type CallLimit = {
  availableAt?: string | null;
  period: "day" | "rolling30Days" | "total";
  tier: EntitlementTier;
};

type LimitLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

type LimitNoticeProps = {
  className?: string;
  linkComponent: LimitLink;
  routes: { signUp: string; upgrade: string };
};

export type LimitWords = { line?: string; provisional?: boolean; title?: string };

/** What the learner asked for when the help ran out; without it the notice names no kind. */
export type HelpKind = "explanations" | "messages" | "mockExams";

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

function toCapLimit(limit: CallLimit): HelpLimit {
  return limit.period === "rolling30Days"
    ? {
        ...limit,
        availableAt: limit.availableAt ?? null,
        period: limit.period,
        status: "limitReached",
      }
    : { period: limit.period, status: "limitReached", tier: limit.tier };
}

type CapTitles = { day: string; guest: string; rolling: string };

/**
 * Every cap reads the same way: what ran out as the title and when more comes back as the line. A
 * guest's title stands alone; a refusal that isn't a cap says what to do.
 */
function useCapWords(limit: HelpLimit, titles: CapTitles): LimitWords {
  const t = useExtracted();
  const comesBack = useComesBackLine(limit);

  if (limit.status === "slowDown") {
    return { line: t("Take a short break, then try again.") };
  }

  if (limit.status === "signUpRequired") {
    return { title: t("This needs a free account") };
  }

  if (limit.tier === "guest") {
    return { title: titles.guest };
  }

  return { ...comesBack, title: isRollingCap(limit) ? titles.rolling : titles.day };
}

function useHelpTitles(kind: HelpKind | undefined): CapTitles {
  const t = useExtracted();
  const guest = t("That's all you can try without an account");

  switch (kind) {
    case "messages":
      return { day: t("No more messages today"), guest, rolling: t("You've used your messages") };
    case "explanations":
      return {
        day: t("No more explanations today"),
        guest,
        rolling: t("You've used your explanations"),
      };
    case "mockExams":
      return {
        day: t("No more mock exams today"),
        guest,
        rolling: t("You've used your mock exams"),
      };
    case undefined:
      return {
        day: t("You've reached today's limit"),
        guest,
        rolling: t("You've reached your limit"),
      };
    default:
      return kind satisfies never;
  }
}

export function useHelpLimitWords(limit: HelpLimit, kind?: HelpKind): LimitWords {
  return useCapWords(limit, useHelpTitles(kind));
}

/** Whether a free learner's next lesson has opened since the refusal: the server then gets asked again. */
export function useFreeLessonReady(limit: LessonLimit): boolean {
  return useOpeningDay(isRollingCap(limit) ? limit.availableAt : null) === "open";
}

export function useLessonLimitWords(limit: LessonLimit): LimitWords {
  const t = useExtracted();
  const ready = useFreeLessonReady(limit);

  const words = useCapWords(limit, {
    day: t("No more new lessons today"),
    guest: t("No more lessons without an account"),
    rolling: t("You've used your free lessons"),
  });

  return ready ? { title: t("Your next free lesson is ready") } : words;
}

function useMindMapRefusalWords(limit: MindMapLimit): LimitWords {
  const t = useExtracted();
  const help = useHelpLimitWords(limit);
  const lesson = useLessonLimitWords(limit);
  const mapLessons = useMapLessonsWords(limit);

  const maps = useCapWords(limit, {
    day: t("No more new mind maps today"),
    guest: t("No more mind maps without an account"),
    rolling: t("You've used your mind maps"),
  });

  if (limit.resource === "chapterLessons" && mapLessons) {
    return mapLessons;
  }

  if (limit.resource === "lessonStart" || limit.resource === "generatedLessons") {
    return lesson;
  }

  return limit.resource === "aiSpend" ? help : maps;
}

function useOutlineLimitWords(limit: OutlineLimit): LimitWords {
  const t = useExtracted();

  return useCapWords(limit, {
    day: t("No more previews today"),
    guest: t("No more previews without an account"),
    rolling: t("You've used your previews"),
  });
}

export function HelpLimitNotice({
  kind,
  limit,
  ...props
}: LimitNoticeProps & { kind?: HelpKind; limit: HelpLimit }) {
  return <LimitNoticeBody {...props} limit={limit} words={useHelpLimitWords(limit, kind)} />;
}

/** A refusal in a bar says what ran out over the bar, and `LimitMainAction` is its way on. */
export function HelpLimitWords({ kind, limit }: { kind?: HelpKind; limit: HelpLimit }) {
  return <GateWords {...useHelpLimitWords(limit, kind)} />;
}

export function LimitMainAction({ limit }: { limit: NoticeLimit }) {
  if (needsAccount(limit)) {
    return <SignUpMainAction />;
  }

  return limit.status === "limitReached" && limit.tier === "free" ? <SubscribeMainAction /> : null;
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

/** When a used-up call cap comes back, for a screen or gate that draws its own way on. */
export function useCallLimitLine(limit: CallLimit): LimitWords {
  return useComesBackLine(toCapLimit(limit));
}

/** Its screen's title says what ran out, so this is only the line and the way on. */
export function CallLimitNotice({ limit, ...props }: LimitNoticeProps & { limit: CallLimit }) {
  const reached = toCapLimit(limit);
  return <LimitNoticeBody {...props} limit={reached} words={useComesBackLine(reached)} />;
}
