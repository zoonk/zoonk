"use client";

import { type ActorHandle, type BuddyActName } from "@zoonk/ui/components/buddy-actor";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { TITLE_ROW_CLASS } from "../_components/title-row";
import { BuddyArt } from "./buddy-art";
import { BuddyStageName } from "./buddy-labels";
import { type BuddyStatusView } from "./buddy-status-view";
import { type LearnBuddy } from "./use-buddy-name";

/** `-mb-12` takes back the page's bottom padding, since the composer has its own. */
export const BUDDY_COLUMN_CLASS =
  "-mb-12 mx-auto flex w-full max-w-form flex-1 flex-col gap-5 lg:-mb-16";

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

/** `children` is the day's line, kept beside the name while it fits; `menu` stays at the end. */
export function BuddyHeader({
  buddy,
  children,
  faceRef,
  menu,
  name,
  stage,
}: {
  buddy: LearnBuddy;
  children?: React.ReactNode;
  faceRef?: React.Ref<ActorHandle<BuddyActName>>;
  menu?: React.ReactNode;
  name: string;
  stage: BuddyStatusView["stage"];
}) {
  return (
    <header className="flex items-center gap-2.5">
      <BuddyArt buddy={buddy} className="size-8" ref={faceRef} />
      <div className={cn(TITLE_ROW_CLASS, "min-w-0 flex-1 gap-x-2.5 gap-y-1")}>
        <div className="flex flex-col">
          <h1 className="stacked:whitespace-normal truncate text-sm leading-snug font-semibold">
            {name}
          </h1>
          <p className="text-muted-foreground stacked:whitespace-normal truncate text-xs leading-snug">
            <BuddyLine stage={stage} />
          </p>
        </div>
        {children}
      </div>
      {menu}
    </header>
  );
}
