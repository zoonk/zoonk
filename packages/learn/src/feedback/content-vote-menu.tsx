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
import { DETAIL_MENU_TRIGGER_CLASS, DetailMenu } from "../_components/detail-page";
import { ContentVoteMenuItems, ReportProblemItem } from "./content-vote-menu-items";
import { useContentFeedback } from "./feedback-context";

/**
 * A page's "…" menu for the AI content it shows, such as a course, a chapter or a question:
 * "Helpful", "Not helpful" and "Report a problem", saved like every other vote. While it's open the
 * screen's keys pause, so a number or Enter can't answer the question under it. `label` names the
 * button for screen readers ("Course options") and `screen` names the page in a report's context.
 * In a page's top bar it takes the bar's size (`size="icon-bar"`); beside a detail page's main
 * action it's that page's outline "…" (`size="detail"`). Hosts without feedback get no menu.
 */
export function ContentVoteMenu({
  label,
  screen,
  size = "icon",
  target,
  votes = true,
}: {
  label: string;
  screen: string;
  size?: "detail" | "icon" | "icon-bar";
  target: ContentVoteTarget;
  /** False for a menu that only reports a problem. */
  votes?: boolean;
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
          size === "detail" ? (
            <Button className={DETAIL_MENU_TRIGGER_CLASS} size="icon" variant="outline" />
          ) : (
            <Button className="shrink-0" size={size} variant="ghost" />
          )
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <ContentVoteMenuItems screen={screen} target={target} votes={votes} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * A detail page's "…" for a page that isn't one piece of AI content (a subject, the exam): only
 * "Report a problem" with the screen attached. Hosts without feedback get no menu.
 */
export function ReportProblemMenu({ label, screen }: { label: string; screen: string }) {
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <DetailMenu label={label}>
      <ReportProblemItem screen={screen} />
    </DetailMenu>
  );
}
