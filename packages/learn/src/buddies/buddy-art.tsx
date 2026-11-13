"use client";

import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { type LearnBuddy, resolveLearnBuddy } from "./use-buddy-name";

type ActorProps = React.ComponentProps<typeof BuddyActor>;

/** The learner's buddy, wherever it shows: `view="face"` with a size below about 64px, the body with a height from there up. */
export function BuddyArt({
  buddy: learnerBuddy,
  label = "",
  ...props
}: { buddy: LearnBuddy | null } & Pick<
  ActorProps,
  "className" | "expression" | "label" | "reaction" | "ref" | "studiedToday" | "view"
>) {
  const buddy = resolveLearnBuddy(learnerBuddy);

  return (
    <BuddyActor
      beltColor={buddy.beltColor}
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={label}
      studiedToday={buddy.studiedToday}
      {...props}
    />
  );
}
