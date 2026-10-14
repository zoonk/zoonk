"use client";

import { useExtracted } from "next-intl";
import { BuddyArt } from "./buddy-art";
import { BuddyStageName } from "./buddy-labels";
import { type BuddyStatusView } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * The buddy tab's column: a conversation's measure (45rem) on the page's left edge, where every
 * title starts, never stretched across a wide screen, and as tall as the screen so the composer
 * sits at its bottom (the page's bottom padding is the composer's own).
 */
export const BUDDY_COLUMN_CLASS = "-mb-12 flex w-full max-w-form flex-1 flex-col gap-5 lg:-mb-16";

/** "Your study buddy · Baby": what the buddy is, and its stage. */
function BuddyLine({ stage }: { stage: BuddyStatusView["stage"] }) {
  const t = useExtracted();

  return (
    <span>
      {t("Your study buddy")}
      {" · "}
      <BuddyStageName stage={stage} />
    </span>
  );
}

/**
 * The buddy on one compact row at the top of its tab: its face, its name (the page's heading) and
 * what it is, with the row's controls at its end (`children`).
 */
export function BuddyHeader({
  buddy,
  children,
  name,
  stage,
}: {
  buddy: LearnBuddy;
  children?: React.ReactNode;
  name: string;
  stage: BuddyStatusView["stage"];
}) {
  return (
    <header className="flex items-center gap-2.5">
      <BuddyArt buddy={buddy} className="size-8" />
      <div className="flex min-w-0 flex-1 flex-col">
        <h1 className="truncate text-sm leading-snug font-semibold">{name}</h1>
        <p className="text-muted-foreground truncate text-xs leading-snug">
          <BuddyLine stage={stage} />
        </p>
      </div>
      {children}
    </header>
  );
}
