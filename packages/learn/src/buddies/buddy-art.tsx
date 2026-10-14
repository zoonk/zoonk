"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { type LearnBuddy, resolveLearnBuddy } from "./use-buddy-name";

/**
 * The learner's buddy as art (the buddy tab's header, a suggestion it brings on Today), sized by
 * `className`. Without a profile, core's default buddy appears. Without `name` it's
 * decorative, for a place whose words already say who it is.
 */
export function BuddyArt({
  buddy: learnerBuddy,
  className,
  name,
}: {
  buddy: LearnBuddy | null;
  className?: string;
  name?: string;
}) {
  const buddy = resolveLearnBuddy(learnerBuddy);

  return (
    <Buddy
      beltColor={buddy.beltColor}
      className={cn("size-16 shrink-0", className)}
      energy={buddy.energy}
      glasses={buddy.glasses}
      kind={buddy.kind}
      label={name ?? ""}
      studiedToday={buddy.studiedToday}
    />
  );
}
