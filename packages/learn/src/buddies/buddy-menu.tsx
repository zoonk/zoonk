"use client";

import { type ResolvedBuddy } from "@zoonk/core/profile/default-buddy";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import {
  BrainCircuitIcon,
  CalendarDaysIcon,
  EllipsisIcon,
  GlassesIcon,
  PencilIcon,
  SmileIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { LearnLink } from "../learn-link";

export type BuddyHrefs = { energy: string; logbook: string; memory: string };

/** The buddy page's "…": what is the buddy's own (its look, its glasses, what it remembers), then the week. */
export function BuddyMenu({
  buddy,
  glassesCount,
  hrefs,
  name,
  onEdit,
  onGlasses,
}: {
  buddy: ResolvedBuddy;
  glassesCount: string;
  hrefs: BuddyHrefs;
  name: string;
  onEdit: () => void;
  onGlasses: () => void;
}) {
  const t = useExtracted();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button edge="end" size="icon-sm" variant="ghost" />}>
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{t("More about {buddy}", { buddy: name })}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={onEdit}>
          {buddy.picked ? <PencilIcon aria-hidden="true" /> : <SmileIcon aria-hidden="true" />}
          {buddy.picked ? t("Change {buddy}", { buddy: name }) : t("Choose your buddy")}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={onGlasses}>
          <GlassesIcon aria-hidden="true" />
          <span className="flex-1">
            {t({
              description:
                "Names the glasses the learner has collected for their study buddy, as a row and a menu item that opens them; {buddy} is the buddy's name. A name, not an action.",
              message: "{buddy}'s glasses",
              values: { buddy: name },
            })}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">{glassesCount}</span>
        </DropdownMenuItem>

        <DropdownMenuItem render={<LearnLink href={hrefs.memory} />}>
          <BrainCircuitIcon aria-hidden="true" />
          {t("What {buddy} remembers", { buddy: name })}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem render={<LearnLink href={hrefs.logbook} />}>
          <CalendarDaysIcon aria-hidden="true" />
          {t("Weekly summary")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
