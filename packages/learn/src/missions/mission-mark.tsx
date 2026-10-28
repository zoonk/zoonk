"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { DoneMark } from "../_components/status-mark";
import { type BuddyMission } from "../buddies/buddy-status-view";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";
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

const FACE_SIZES = { buddy: "size-4", done: "size-3.5", trickster: "-m-1 size-5" } as const;

export function BuddyFace({ buddy, className }: { buddy: LearnBuddy | null; className?: string }) {
  const face = resolveLearnBuddy(buddy);

  return (
    <Buddy
      beltColor={face.beltColor}
      className={cn("shrink-0", className)}
      crop="face"
      energy={face.energy}
      glasses={face.glasses}
      kind={face.kind}
      studiedToday={face.studiedToday}
    />
  );
}

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
    return <DoneMark className={FACE_SIZES.done} />;
  }

  if (block) {
    return <BlockMark block={block} />;
  }

  if (mark === "trickster") {
    return <Trickster className={FACE_SIZES.trickster} />;
  }

  if (mark === "buddy") {
    return <BuddyFace buddy={buddy} className={FACE_SIZES.buddy} />;
  }

  return <KindMark kind={mark} />;
}
