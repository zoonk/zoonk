"use client";

import { type ActorHandle, type BuddyActName, BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { type LearnBuddy, resolveLearnBuddy } from "./use-buddy-name";

export function BuddyArt({
  buddy: learnerBuddy,
  className,
  ref,
}: {
  buddy: LearnBuddy | null;
  className?: string;
  ref?: React.Ref<ActorHandle<BuddyActName>>;
}) {
  const buddy = resolveLearnBuddy(learnerBuddy);

  return (
    <BuddyActor
      beltColor={buddy.beltColor}
      className={cn("size-16 shrink-0", className)}
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      label=""
      ref={ref}
      studiedToday={buddy.studiedToday}
    />
  );
}
