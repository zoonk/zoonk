"use client";

import { Buddy, type BuddyExpression } from "@zoonk/ui/components/buddy";
import { type BuddyLineEvent, BuddySpeech, useBuddyLine } from "./buddy-lines";
import { type LearnBuddy } from "./use-buddy-name";

/** Three first-try right answers in a row is worth a cheer ("Three in a row!"). */
const STREAK_CHEER = 3;

type LessonMoment = {
  isComplete?: boolean;
  position: number;
  result: { isCorrect: boolean; isGuess?: boolean } | null;
  rightInARow: number;
};

function getMoment({ position, result, rightInARow }: LessonMoment): {
  event: BuddyLineEvent | null;
  expression: BuddyExpression;
} {
  if (result?.isCorrect) {
    return {
      event: rightInARow >= STREAK_CHEER ? "rightStreak" : "rightAnswer",
      expression: "cheer",
    };
  }

  // A guess before the explanation costs nothing: its answer is something new, not a mistake.
  if (result?.isGuess) {
    return { event: "guessRevealed", expression: "happy" };
  }

  if (result) {
    return { event: "wrongAnswer", expression: "kind" };
  }

  return { event: position === 0 ? "lessonStart" : null, expression: "happy" };
}

/**
 * The buddy beside a Fun lesson's paper: it reacts to answers with a short fixed line and says
 * nothing while the learner reads, so it never gets in the way of the text.
 *
 * A row as tall as the buddy, with the bubble beside it (two lines fit), so a line coming or going
 * never moves the lesson. In the player's side column on desktop the bubble sits under the buddy.
 */
export function LessonBuddyCompanion({ buddy, ...moment }: LessonMoment & { buddy: LearnBuddy }) {
  const { event, expression } = getMoment(moment);
  // The lesson's end always gets the first cheer ("Nice one!"), whatever screen it ended on.
  const line = useBuddyLine(event ?? "lessonStart", moment.isComplete ? 0 : moment.position);

  return (
    <div className="flex min-h-14 items-center gap-2 lg:in-data-[slot=fun-companion]:flex-col lg:in-data-[slot=fun-companion]:items-end">
      <Buddy
        beltColor={buddy.beltColor}
        className="size-14 shrink-0"
        energy={buddy.energy}
        expression={expression}
        glasses={buddy.glasses}
        kind={buddy.kind}
      />

      {/* Always on the page, so every new line is announced, not only the first. */}
      <div aria-live="polite" className="flex min-w-0">
        {event && (
          <BuddySpeech
            className="fun-glass text-fun-fg animate-in fade-in-0 zoom-in-95 max-w-56 rounded-2xl rounded-bl-md px-3 py-1.5 text-sm font-medium duration-200 lg:in-data-[slot=fun-companion]:rounded-tr-md lg:in-data-[slot=fun-companion]:rounded-bl-2xl"
            key={line}
          >
            {line}
          </BuddySpeech>
        )}
      </div>
    </div>
  );
}
