"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { useReviewTitle } from "../session/use-review-title";
import { ProgressCount } from "./mission-list";

type MissionOpens = NonNullable<Mission["opens"]>;
type MissionKind = Mission["kind"];
type MissionDetail = Mission["detail"];

/**
 * "Review", "Finish Percentages", "Take on the Trickster": a mission by its name, the same on
 * Today's chips and in the buddy's list. Names are verbs where they ask for something ("Write the
 * essay"), so their own namespace keeps "Practice" apart from the noun elsewhere.
 */
export function useMissionName(buddy: Pick<LearnBuddy, "kind" | "name"> | null) {
  const t = useExtracted("missions");
  const buddyName = useBuddyName(buddy);

  const chapter = (detail: MissionDetail) =>
    detail?.chapterTitle
      ? t("Finish “{chapter}”", { chapter: detail.chapterTitle })
      : t("Finish the chapter");

  const challenge = (detail: MissionDetail) =>
    detail?.rematch ? t("Rematch the Trickster") : t("Take on the Trickster");

  const area = (detail: MissionDetail) =>
    detail?.areaTitle ? t("Practice {area}", { area: detail.areaTitle }) : t("Practice");

  return ({ detail, kind, total }: Pick<Mission, "detail" | "kind" | "total">): string => {
    switch (kind) {
      case "review":
        return t("Review");
      case "somethingNew":
        return t("Do a new lesson");
      case "finishChapter":
        return chapter(detail);
      case "challenge":
        return challenge(detail);
      case "weeklyChallenge":
        return t("Weekly challenge");
      case "mock":
        return t("Take the mock");
      case "essay":
        return t("Practice writing");
      case "practice":
        return t("Practice");
      case "fixMistake":
        return t("{count, plural, one {Fix a mistake} other {Fix # mistakes}}", { count: total });
      case "pattern":
        return t("Practice a pattern");
      case "pronunciation":
        return t("Pronunciation");
      case "call":
        return t("Have a call");
      case "askBuddy":
        return t("Ask {buddy} something", { buddy: buddyName });
      case "weakSpot":
        return area(detail);
      default:
        return kind satisfies never;
    }
  };
}

/** What a mission or step is, by its state, for screen readers after its name. */
type MissionState = {
  /** On the buddy's own tab, asking it is its composer right there. */
  asks: boolean;
  detail?: MissionDetail;
  done: boolean;
  kind: MissionKind;
  opens?: MissionOpens;
  waitReason?: Mission["waitReason"];
};

/** ", go to today's review": where opening a mission still to do goes, for screen readers. */
function useOpensLabel(buddy: LearnBuddy | null) {
  const t = useExtracted();
  const buddyName = useBuddyName(buddy);

  const mock = (opens?: MissionOpens) =>
    opens?.kind === "mockChooser" ? t(", choose a mock exam") : t(", go to today's mock");

  const ask = (asks: boolean) =>
    asks ? t(", write your question") : t(", go to {buddy}", { buddy: buddyName });

  const area = (detail: MissionDetail) =>
    detail?.areaTitle
      ? t(", practice {area}", { area: detail.areaTitle })
      : t(", go to today's practice");

  return ({ asks, detail, kind, opens }: MissionState): string => {
    switch (kind) {
      case "review":
        return t(", go to today's review");
      case "somethingNew":
        return t(", go to today's new lesson");
      case "finishChapter":
        return t(", go to the chapter's next lesson");
      case "challenge":
      case "weeklyChallenge":
        return t(", go to the challenge");
      case "mock":
        return mock(opens);
      case "essay":
        return t(", go to today's essay");
      case "practice":
        return t(", go to today's practice");
      case "fixMistake":
        return t(", practice your mistakes");
      case "pattern":
        return t(", go to the pattern");
      case "pronunciation":
        return t(", go to pronunciation practice");
      case "call":
        return t(", choose a call");
      case "askBuddy":
        return ask(asks);
      case "weakSpot":
        return area(detail);
      default:
        return kind satisfies never;
    }
  };
}

/**
 * Said after a mission's (or a first step's) name, for screen readers: that it's done, why it
 * can't open yet, or where opening it goes ("Review, go to today's review"). Nothing for one with
 * nowhere to open.
 */
export function useMissionStateLabel(buddy: LearnBuddy | null) {
  const t = useExtracted();
  const opensLabel = useOpensLabel(buddy);

  return (state: MissionState): string | undefined => {
    if (state.done) {
      return t(", done");
    }

    if (state.waitReason === "lessons") {
      return t(", after today's lessons");
    }

    if (state.waitReason === "challenge") {
      return t(", after the challenge before it");
    }

    return state.opens ? opensLabel(state) : undefined;
  };
}

/** A number in a line of words in the mono face. */
export function renderMono(chunks: React.ReactNode) {
  return <span className="font-mono tabular-nums">{chunks}</span>;
}

type WaitReason = NonNullable<Mission["waitReason"]>;

/** What a challenge waits for before it can open, as its row in the day says. */
function useWaitLine() {
  const t = useExtracted();

  return (reason: WaitReason): string =>
    reason === "lessons" ? t("After today's lessons") : t("After the challenge before it");
}

export function WaitLine({ reason }: { reason: WaitReason }) {
  return useWaitLine()(reason);
}

/** Work outside the day's blocks has an estimate ("~3 min"); a block has its planned minutes. */
const ESTIMATED_KINDS: ReadonlySet<MissionKind> = new Set([
  "askBuddy",
  "call",
  "fixMistake",
  "pattern",
  "pronunciation",
]);

/** Where a mission done outside the day's blocks is done, in words. */
function useOutsideStep() {
  const t = useExtracted();

  return function outsideStep({ detail, kind }: Mission): string | null {
    switch (kind) {
      case "fixMistake":
        return t("From your mistakes notebook");
      case "pattern":
        return detail?.patternTitle ?? null;
      case "pronunciation":
        return t("Due today");
      case "call":
        return detail?.chapterTitle
          ? t("Quick call · {unit}", { unit: detail.chapterTitle })
          : t("A quick call");
      case "askBuddy":
        return t("Anything about today's lessons");
      case "review":
      case "somethingNew":
      case "finishChapter":
      case "challenge":
      case "weeklyChallenge":
      case "mock":
      case "essay":
      case "practice":
      case "weakSpot":
        return null;
      default:
        return kind satisfies never;
    }
  };
}

/** A chapter's next lesson, and how many more it asks after that one. */
function useChapterStep() {
  const t = useExtracted();

  return function chapterStep({ detail, done, total }: Mission): string {
    const more = total - done - 1;

    if (!detail?.title) {
      return t(
        "{count, plural, one {The last lesson is in today's plan} other {The last # lessons are in today's plan}}",
        { count: total - done },
      );
    }

    return more > 0
      ? t("{title} (+{count, plural, one {# lesson} other {# lessons}})", {
          count: more,
          title: detail.title,
        })
      : detail.title;
  };
}

/**
 * What a mission still asks, in words: what its block waits for, the block it opens by its queue
 * name (a chapter's next lesson and how many after it), or the place it's done.
 */
function useMissionStep() {
  const t = useExtracted();
  const waitLine = useWaitLine();
  const outsideStep = useOutsideStep();
  const chapterStep = useChapterStep();
  const reviewTitle = useReviewTitle();

  return function missionStep(mission: Mission): string | null {
    const { detail, kind, waitReason } = mission;

    if (waitReason) {
      return waitLine(waitReason);
    }

    if (ESTIMATED_KINDS.has(kind)) {
      return outsideStep(mission);
    }

    if (kind === "finishChapter") {
      return chapterStep(mission);
    }

    if (detail?.title) {
      return detail.title;
    }

    if (kind === "review") {
      return reviewTitle(mission.minutes ?? 0);
    }

    if (kind === "somethingNew") {
      return t("Finish today's new lesson");
    }

    return kind === "weakSpot" ? t("Most room to grow") : null;
  };
}

/** "5 min" for a block, "~3 min" for work outside the day's blocks, in the mono face. */
function MissionMinutes({ kind, minutes }: { kind?: MissionKind; minutes: number }) {
  const formatDuration = useFormatDuration();
  const estimate = kind === undefined || ESTIMATED_KINDS.has(kind);

  return (
    <span className="font-mono tabular-nums">
      {estimate ? `~${formatDuration(minutes)}` : formatDuration(minutes)}
    </span>
  );
}

/**
 * What a mission still asks, under its name: how far a multi-step one is ("1/3"), the block it
 * opens (a chapter's next lesson, and how many after it) or where it's done, and about how long it
 * takes. A challenge that has to wait says what for. The minutes stay with the line's last word,
 * so a narrow column never leaves them alone on a line.
 */
export function MissionStepLine({ mission }: { mission: Mission }) {
  const step = useMissionStep()(mission);
  const minutes = mission.minutes ?? 0;
  const count = mission.total > 1 && <ProgressCount done={mission.done} total={mission.total} />;

  return (
    <>
      {count && <span className="font-mono tabular-nums">{count}</span>}
      {count && step && " · "}
      {step}
      {minutes > 0 && (
        <span className="whitespace-nowrap">
          {step || count ? "\u00A0· " : ""}
          <MissionMinutes kind={mission.kind} minutes={minutes} />
        </span>
      )}
    </>
  );
}
