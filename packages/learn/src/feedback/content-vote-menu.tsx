"use client";

import { type ContentVoteTarget } from "@zoonk/core/feedback/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";
import { useEffect, useId } from "react";
import { DETAIL_MENU_TRIGGER_CLASS, DetailMenu } from "../_components/detail-page";
import { TASK_HEADER_ICON_CLASS } from "../_components/task-header";
import { ReportProblemItem } from "./content-vote-menu-items";
import { useContentFeedback } from "./feedback-context";

/**
 * A page's "…" menu for the AI content it shows, such as a course, a chapter or a question: "Report
 * a problem" with that content attached. While it's open the screen's keys pause, so a number or
 * Enter can't answer the question under it. `label` names the button for screen readers ("Course
 * options") and `screen` names the page in a report's context. In a page's top bar it takes the
 * bar's size (`size="icon-bar"`); beside a detail page's main action it's that page's outline "…"
 * (`size="detail"`); in a task's header its glyph sits on the column's edge (`size="task"`). Hosts
 * without feedback get no menu.
 */
export function ContentVoteMenu({
  label,
  screen,
  size = "icon",
  target,
}: {
  label: string;
  screen: string;
  size?: "detail" | "icon" | "icon-bar" | "task";
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
          size === "detail" ? (
            <Button className={DETAIL_MENU_TRIGGER_CLASS} size="icon" variant="outline" />
          ) : (
            <Button
              className={cn("shrink-0", size === "task" && TASK_HEADER_ICON_CLASS.end)}
              size={size === "task" ? "icon" : size}
              variant="ghost"
            />
          )
        }
      >
        <EllipsisIcon aria-hidden="true" />
        <span className="sr-only">{label}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <ReportProblemItem screen={screen} target={target} />
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
