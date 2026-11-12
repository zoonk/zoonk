"use client";

import { type FeedbackTarget } from "@zoonk/core/feedback/contract";
import { Button } from "@zoonk/ui/components/button";
import { DETAIL_MENU_TRIGGER_CLASS, DetailMenu } from "@zoonk/ui/components/detail";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { EllipsisIcon } from "lucide-react";
import { useEffect, useId } from "react";
import { TASK_HEADER_ICON_CLASS } from "../_components/task-header";
import { useContentFeedback } from "./feedback-context";
import { ReportProblemItem } from "./report-problem-item";

export function ContentFeedbackMenu({
  label,
  screen,
  size = "icon",
  target,
}: {
  label: string;
  screen: string;
  size?: "detail" | "icon" | "icon-bar" | "task";
  target: FeedbackTarget;
}) {
  const feedback = useContentFeedback();
  const menuId = useId();
  const setMenuOpen = feedback?.setMenuOpen;

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

/** `place="bar"` is the page bar's borderless icon; the default is the bordered one beside a page's main button. */
export function ReportProblemMenu({
  label,
  place = "detail",
  screen,
}: {
  label: string;
  place?: "bar" | "detail";
  screen: string;
}) {
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  if (place === "bar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button className="shrink-0" size="icon-bar" variant="ghost" />}
        >
          <EllipsisIcon aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-60">
          <ReportProblemItem screen={screen} />
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DetailMenu label={label}>
      <ReportProblemItem screen={screen} />
    </DetailMenu>
  );
}
