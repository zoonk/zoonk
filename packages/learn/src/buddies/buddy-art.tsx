"use client";

import { type ActorHandle, type BuddyActName, BuddyActor } from "@zoonk/ui/components/buddy-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { type LearnBuddy, resolveLearnBuddy } from "./use-buddy-name";

/**
 * The learner's buddy as art (the buddy tab's header), sized by `className`, in its Energy's face.
 * Without a profile, core's default buddy appears. It holds still unless its screen makes it act
 * (`ref.play`), as when its answer comes in. It's decorative: the words beside it say who it is.
 */
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
