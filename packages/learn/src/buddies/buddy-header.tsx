"use client";

import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { PAGE_HEADER_CLASS } from "@zoonk/ui/components/page-header-class";
import { BuddyArt } from "./buddy-art";
import { BUDDY_NAME_CLASS, BuddyIdentityRow } from "./buddy-identity-row";
import { type LearnBuddy } from "./use-buddy-name";

/**
 * `-mb-12` takes back the page's bottom padding, since the composer has its own.
 */
export const BUDDY_COLUMN_CLASS =
  "max-w-column mx-auto -mb-12 flex w-full flex-1 flex-col gap-5 lg:-mb-16";

/** `children` is the day's line. The name's line is 32px, so the title starts where every page's does. */
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
      <BuddyIdentityRow
        face={<BuddyArt buddy={buddy} className="size-8" ref={faceRef} view="face" />}
        menu={menu}
        title={<h1 className={BUDDY_NAME_CLASS}>{name}</h1>}
      >
        {children}
      </BuddyIdentityRow>
    </header>
  );
}
