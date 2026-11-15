"use client";

import { type EntitlementTier } from "@zoonk/core/entitlements/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { type ReactNode } from "react";
import {
  isRollingCap,
  receivedAtOf,
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

/**
 * A refusal as it arrives in answer to a request this screen just made, stamped with that moment so
 * a server clock behind this device's can be told from a refusal that's over. A refusal restored
 * from an address or a page is never stamped.
 */
export function received<Refusal extends object>(refusal: Refusal): Refusal {
  return { ...refusal, receivedAt: Date.now() };
}

/** A refusal lasts until its instant: then the action it took the place of is back, and the server decides again. */
export function useLiveLimit<Limit extends object>(limit: Limit | null): Limit | null {
  const availableAt =
    limit && "availableAt" in limit && typeof limit.availableAt === "string"
      ? limit.availableAt
      : null;

  return useOpeningDay(availableAt, receivedAtOf(limit)) === "open" ? null : limit;
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
  /** When this device received the refusal, for one that answers a request just made. */
  receivedAt?: number;
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
  /** When this device received the refusal, for one that answers a request just made. */
  receivedAt?: number;
  tier: EntitlementTier;
};

type LimitLink = (props: { children: ReactNode; className?: string; href: string }) => ReactNode;

type LimitNoticeProps = {
  className?: string;
  linkComponent: LimitLink;
  routes: { signUp: string; upgrade: string };
};

/**
 * `opened`: the cap's day has come, so nothing ran out any more: no title says it did and nothing is
 * offered to buy; only `line` (or the lesson's ready title) is said.
 */
export type LimitWords = { line?: string; opened?: boolean; provisional?: boolean; title?: string };

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

function toWayOn({
  limit,
  linkComponent,
  routes,
}: Omit<LimitNoticeProps, "className"> & { limit: NoticeLimit }): ReactNode {
  if (limit.status === "slowDown" || (limit.status === "limitReached" && limit.tier === "plus")) {
    return null;
  }

  return needsAccount(limit) ? (
    <CreateAccountLink href={routes.signUp} />
  ) : (
    <SubscribeAction href={routes.upgrade} link={linkComponent} />
  );
}

function LimitNoticeBody({
  action,
  className,
  limit,
  linkComponent,
  routes,
  words,
}: LimitNoticeProps & { action?: ReactNode; limit: NoticeLimit; words: LimitWords }) {
  const wayOn = words.opened ? null : toWayOn({ limit, linkComponent, routes });

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <GateWords line={words.line} provisional={words.provisional} title={words.title} />

      {(wayOn || action) && (
        <div className="flex flex-wrap gap-2">
          {wayOn}
          {action}
        </div>
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

  if (comesBack.opened) {
    return { line: comesBack.line, opened: true };
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
  return (
    useOpeningDay(isRollingCap(limit) ? limit.availableAt : null, receivedAtOf(limit)) === "open"
  );
}

export function useLessonLimitWords(limit: LessonLimit): LimitWords {
  const t = useExtracted();
  const ready = useFreeLessonReady(limit);

  const words = useCapWords(limit, {
    day: t("No more new lessons today"),
    guest: t("No more lessons without an account"),
    rolling: t("You've used your free lessons"),
  });

  return ready ? { opened: true, title: t("Your next free lesson is ready") } : words;
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

/** `action` sits beside its Subscribe, such as starting the lesson once the free one is back. */
export function LessonLimitNotice({
  limit,
  ...props
}: LimitNoticeProps & { action?: ReactNode; limit: LessonLimit }) {
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

/** Without `title`, its screen's title says what ran out, and this is only the line and the way on. */
export function CallLimitNotice({
  limit,
  title,
  ...props
}: LimitNoticeProps & { limit: CallLimit; title?: string }) {
  const reached = toCapLimit(limit);
  const comesBack = useComesBackLine(reached);

  return (
    <LimitNoticeBody
      {...props}
      limit={reached}
      words={{ ...comesBack, title: comesBack.opened ? undefined : title }}
    />
  );
}
