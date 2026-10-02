"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { EllipsisIcon } from "lucide-react";
import { useEffect, useId } from "react";
import { ContentVoteMenuItems } from "./content-vote-menu-items";
import { useContentFeedback } from "./feedback-context";

/**
 * A page's "…" menu for the AI content it shows, such as a course, a chapter or a question:
 * "Helpful", "Not helpful" and "Report a problem", saved like every other vote. While it's open the
 * screen's keys pause, so a number or Enter can't answer the question under it. `label` names the
 * button for screen readers ("Course options") and `screen` names the page in a report's context.
 * Hosts without feedback get no menu.
 */
export function ContentVoteMenu({
  label,
  screen,
  target,
}: {
  label: string;
  screen: string;
  target: ContentVoteTarget;
}) {
  const feedback = useContentFeedback();
  const menuId = useId();
  const setMenuOpen = feedback?.setMenuOpen;

  // A menu that goes away while open (the question moved on) no longer pauses the screen.
  useEffect(() => () => setMenuOpen?.({ menuId, open: false }), [menuId, setMenuOpen]);

  if (!feedback) {
    return null;
  }

  return (
    <DropdownMenu onOpenChange={(open) => feedback.setMenuOpen({ menuId, open })}>
      <DropdownMenuTrigger
        render={
          <Button className="in-data-[mode=fun]:fun-glass shrink-0" size="icon" variant="ghost" />
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <ContentVoteMenuItems screen={screen} target={target} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
