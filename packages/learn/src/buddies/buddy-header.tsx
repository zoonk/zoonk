"use client";

import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { cn } from "@zoonk/ui/lib/utils";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { BuddyArt } from "./buddy-art";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * Starts on the page's edge like every other page in the app, so the buddy's pages share one edge.
 * `-mb-12` takes back the page's bottom padding, since the composer has its own.
 */
export const BUDDY_COLUMN_CLASS = "-mb-12 flex w-full max-w-form flex-1 flex-col gap-5 lg:-mb-16";

/**
 * `children` is the day's line, kept beside the name while it fits; `menu` stays at the end. The
 * name's line is the face's 32px, so the title starts where every page's does.
 */
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
  return (
    <header className={PAGE_HEADER_CLASS}>
      <div className="flex items-center gap-2.5">
        <BuddyArt buddy={buddy} className="size-8" ref={faceRef} view="face" />
        <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1 gap-x-2.5 gap-y-1")}>
          <h1 className={cn(TRUNCATED_TITLE_CLASS, "text-sm leading-8 font-semibold")}>{name}</h1>
          {children}
        </div>
        {menu}
      </div>
    </header>
  );
}
