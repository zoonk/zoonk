"use client";

import { BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { type LearnBuddy, resolveLearnBuddy } from "./use-buddy-name";

type ActorProps = React.ComponentProps<typeof BuddyActor>;

/** The learner's buddy, wherever it shows: `view="face"` below about 64px, the body from there up. */
export function BuddyArt({
  buddy: learnerBuddy,
  className,
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
      className={cn("size-16 shrink-0", className)}
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={label}
      studiedToday={buddy.studiedToday}
      {...props}
    />
  );
}
