"use client";

import { Buddy } from "@zoonk/ui/components/buddy";
import { cn } from "@zoonk/ui/lib/utils";
import { SmileIcon } from "lucide-react";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * The learner's buddy as art (the buddy tab's header, a suggestion it brings on Today), sized by
 * `className`. Before a buddy is picked, a neutral face holds its place. Without `name` it's
 * decorative, for a place whose words already say who it is.
 */
export function BuddyArt({
  buddy,
  className,
  name,
}: {
  buddy: LearnBuddy | null;
  className?: string;
  name?: string;
}) {
  if (!buddy) {
    return (
      <span
        aria-hidden="true"
        className={cn(
          "bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-full [&>svg]:size-1/2",
          className,
        )}
      >
        <SmileIcon />
      </span>
    );
  }

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
