"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { KindMark, type LearnKind } from "../_components/kind-tile";
import { DoneMark } from "../_components/status-mark";
import { type BuddyMission } from "../buddies/buddy-status-view";
import { type LearnBuddy, resolveLearnBuddy } from "../buddies/use-buddy-name";

type MissionKind = BuddyMission["kind"];

/**
 * What each mission wears while it's to do, the one map from a mission (or a first step, which
 * shares its kinds) to its mark: the dot of the kind of work it asks for, as Today's queue marks
 * that work, or a character's face where the mission is the character's (the Trickster's duel,
 * a question to the buddy). A mission added without its mark fails the type check.
 */
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

/** A row's mark sits in its 16px leading column; the Trickster's horns reach past it. */
const FACE_SIZES = { buddy: "size-4", done: "size-3.5", trickster: "-m-1 size-5" } as const;

/** The learner's buddy's face (the default buddy's before one is chosen). Decorative. */
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

/**
 * A mission's mark, the same in the missions card (on Today and in the buddy's day) and among the
 * first steps: its kind's icon (or its character's face) while it's to do, and the done mark every
 * list shares once done. Decorative: the words beside it name the mission and its state.
 */
export function MissionMark({
  buddy,
  done,
  kind,
}: {
  /** The learner's buddy, whose face marks a question to it. */
  buddy: LearnBuddy | null;
  done: boolean;
  kind: MissionKind;
}) {
  const mark = MISSION_MARKS[kind];

  if (done) {
    return <DoneMark className={FACE_SIZES.done} />;
  }

  if (mark === "trickster") {
    return <Trickster className={FACE_SIZES.trickster} />;
  }

  if (mark === "buddy") {
    return <BuddyFace buddy={buddy} className={FACE_SIZES.buddy} />;
  }

  return <KindMark kind={mark} />;
}
