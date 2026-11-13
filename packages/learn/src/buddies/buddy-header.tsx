"use client";

import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { useExtracted } from "next-intl";
import { BuddyArt } from "./buddy-art";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * Starts on the page's edge like every other page in the app, so the buddy's pages share one edge.
 * `-mb-12` takes back the page's bottom padding, since the composer has its own.
 */
export const BUDDY_COLUMN_CLASS = "-mb-12 flex w-full max-w-form flex-1 flex-col gap-5 lg:-mb-16";

/** `children` is the day's line, under the name in place of the buddy's line; `menu` stays at the end. */
export function BuddyHeader({
  buddy,
  children,
  faceRef,
  menu,
  name,
}: {
  buddy: LearnBuddy;
  children?: React.ReactNode;
  faceRef?: React.Ref<ActorHandle<BuddyActName>>;
  menu?: React.ReactNode;
  name: string;
}) {
  const t = useExtracted();

  return (
    <header className="flex items-center gap-2.5">
      <BuddyArt buddy={buddy} className="size-8" ref={faceRef} view="face" />
      <div className="flex min-w-0 flex-1 flex-col items-start">
        <h1 className="max-w-full truncate text-sm leading-snug font-semibold">{name}</h1>
        {children ?? (
          <p className="text-muted-foreground max-w-full truncate text-xs leading-snug">
            {t("Your study buddy")}
          </p>
        )}
      </div>
      {menu}
    </header>
  );
}
