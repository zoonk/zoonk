"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type DayStep } from "../session/session-types";
import { useBlockTitle } from "../session/use-block-copy";
import { useReviewTitle } from "../session/use-review-title";
import { type MissionView } from "./mission-links";
import { ProgressCount } from "./mission-list";

type MissionOpens = NonNullable<MissionView["opens"]>;
type MissionKind = Mission["kind"];
type MissionDetail = Mission["detail"];

/** Its own namespace keeps the verb "Practice" apart from the noun elsewhere. */
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
        return t({ description: "A mission to practice an essay.", message: "Practice writing" });
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

type MissionState = {
  asks: boolean;
  done: boolean;
  kind: MissionKind;
  opens?: MissionOpens;
  waitReason?: Mission["waitReason"];
};

function useOpensLabel(buddy: LearnBuddy | null) {
  const t = useExtracted();
  const buddyName = useBuddyName(buddy);

  const mock = (opens?: MissionOpens) =>
    opens?.kind === "mockChooser" ? t(", choose a mock exam") : t(", go to today's mock");

  const ask = (asks: boolean) =>
    asks ? t(", write your question") : t(", go to {buddy}", { buddy: buddyName });

  return ({ asks, kind, opens }: MissionState): string => {
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
      case "weakSpot":
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
      default:
        return kind satisfies never;
    }
  };
}

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

/** Messages mark it `<mono>`, but a number in a sentence keeps the sentence's face. */
export function renderSentenceNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

type WaitReason = NonNullable<Mission["waitReason"]>;

function useWaitLine() {
  const t = useExtracted();

  return (reason: WaitReason): string =>
    reason === "lessons" ? t("After today's lessons") : t("After the challenge before it");
}

export function WaitLine({ reason }: { reason: WaitReason }) {
  return useWaitLine()(reason);
}

const ESTIMATED_KINDS: ReadonlySet<MissionKind> = new Set([
  "askBuddy",
  "call",
  "fixMistake",
  "pattern",
  "pronunciation",
]);

function useOutsideStep() {
  const t = useExtracted();

  return function outsideStep({
    detail,
    kind,
  }: Pick<MissionView, "detail" | "kind">): string | null {
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

function useChapterStep() {
  const t = useExtracted();

  return function chapterStep({
    detail,
    done,
    total,
  }: Pick<MissionView, "detail" | "done" | "total">): string {
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

function useMissionStep() {
  const t = useExtracted();
  const waitLine = useWaitLine();
  const outsideStep = useOutsideStep();
  const chapterStep = useChapterStep();
  const reviewTitle = useReviewTitle();
  const blockTitle = useBlockTitle();

  return function missionStep(mission: MissionView, block?: DayStep): string | null {
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

    if (block && kind !== "weeklyChallenge" && kind !== "mock") {
      return blockTitle(block);
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

function MissionMinutes({ kind, minutes }: { kind?: MissionKind; minutes: number }) {
  const formatDuration = useFormatDuration();
  const estimate = kind === undefined || ESTIMATED_KINDS.has(kind);

  return (
    <span className="font-mono tabular-nums">
      {estimate ? `~${formatDuration(minutes)}` : formatDuration(minutes)}
    </span>
  );
}

export function MissionStepLine({ block, mission }: { block?: DayStep; mission: MissionView }) {
  const step = useMissionStep()(mission, block);
  const minutes = mission.minutes ?? 0;
  const count = mission.total > 1 && <ProgressCount done={mission.done} total={mission.total} />;

  return (
    <span className="flex min-w-0 whitespace-pre">
      {count && <span className="shrink-0 font-mono tabular-nums">{count}</span>}
      {count && step && " · "}
      {step && <span className="truncate">{step}</span>}
      {minutes > 0 && (
        <span className="shrink-0">
          {step || count ? " · " : ""}
          <MissionMinutes kind={mission.kind} minutes={minutes} />
        </span>
      )}
    </span>
  );
}
