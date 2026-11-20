"use client";

import { Trickster } from "@zoonk/ui/components/trickster";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { DoneMark } from "../_components/status-mark";
import { BuddyArt } from "../buddies/buddy-art";
import { type BuddyMission } from "../buddies/buddy-status-view";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { BlockMark } from "../session/block-mark";
import { type DayStep } from "../session/session-types";

type MissionKind = BuddyMission["kind"];

const MISSION_MARKS = {
  askBuddy: "buddy",
  call: "conversation",
  challenge: "trickster",
  essay: "essay",
  finishChapter: "lesson",
  fixMistake: "mistakes",
  mock: "mock",
  pattern: "mistakes",
  practice: "practice",
  pronunciation: "review",
  review: "review",
  somethingNew: "lesson",
  weakSpot: "practice",
  weeklyChallenge: "challenge",
} as const satisfies Readonly<Record<MissionKind, LearnKind | "buddy" | "trickster">>;

const MARK_SIZES = { character: "size-4", done: "size-3.5" } as const;

export function MissionMark({
  block,
  buddy,
  done,
  kind,
}: {
  block?: DayStep;
  buddy: LearnBuddy | null;
  done: boolean;
  kind: MissionKind;
}) {
  const mark = MISSION_MARKS[kind];

  if (done) {
    return <DoneMark className={MARK_SIZES.done} />;
  }

  if (block) {
    return <BlockMark block={block} />;
  }

  if (mark === "trickster") {
    return <Trickster className={MARK_SIZES.character} view="face" />;
  }

  if (mark === "buddy") {
    return <BuddyArt buddy={buddy} className={MARK_SIZES.character} view="face" />;
  }

  return <KindMark kind={mark} />;
}
