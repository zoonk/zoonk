"use client";

import { type Mission } from "@zoonk/core/sessions/missions";
import { useExtracted } from "next-intl";
import { type LearnBuddy, useBuddyName } from "../buddies/use-buddy-name";
import { type MissionView } from "./mission-links";

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
    detail?.rematch ? t("Rematch the Trickster") : t("Beat the Trickster");

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
        return t("Take the mock exam");
      case "essay":
        return t({ description: "A mission to practice an essay.", message: "Practice writing" });
      case "practice":
        return t("Practice");
      case "fixMistake":
        return t("{count, plural, one {Fix a mistake} other {Fix # mistakes}}", { count: total });
      case "pattern":
        return t("Practice a pattern");
      case "pronunciation":
        return t("Practice pronunciation");
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

    if (state.waitReason) {
      return t(", after today's lessons");
    }

    return state.opens ? opensLabel(state) : undefined;
  };
}

/** Messages mark it `<mono>`, but a number in a sentence keeps the sentence's face. */
export function renderSentenceNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

/** Only a challenge waits, for the lessons before it in the day. */
export function useWaitLine() {
  const t = useExtracted();
  return (): string => t("After today's lessons");
}

/** A mission is its name; only one that waits says why it can't be opened yet. */
export function MissionStepLine({ mission }: { mission: Pick<MissionView, "waitReason"> }) {
  const waitLine = useWaitLine();
  return mission.waitReason ? waitLine() : null;
}
