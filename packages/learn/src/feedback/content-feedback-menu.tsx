"use client";

import { type FeedbackTarget } from "@zoonk/core/feedback/contract";
import { useEffect, useId } from "react";
import { TaskHeaderMenu } from "../_components/task-header";
import { useContentFeedback } from "./feedback-context";
import { ReportProblemItem } from "./report-problem-item";

export function ContentFeedbackMenu({
  label,
  screen,
  target,
}: {
  label: string;
  screen: string;
  target: FeedbackTarget;
}) {
  const feedback = useContentFeedback();
  const menuId = useId();
  const setMenuOpen = feedback?.setMenuOpen;

  useEffect(() => () => setMenuOpen?.({ menuId, open: false }), [menuId, setMenuOpen]);

  if (!feedback) {
    return null;
  }

  const onOpenChange = (open: boolean) => feedback.setMenuOpen({ menuId, open });

  return (
    <TaskHeaderMenu className="w-60" label={label} onOpenChange={onOpenChange}>
      <ReportProblemItem screen={screen} target={target} />
    </TaskHeaderMenu>
  );
}

/** The same "…" for a report about the screen as a whole, with no one piece of content to name. */
export function ReportProblemMenu({ label, screen }: { label: string; screen: string }) {
  const feedback = useContentFeedback();

  if (!feedback) {
    return null;
  }

  return (
    <TaskHeaderMenu className="w-60" label={label}>
      <ReportProblemItem screen={screen} />
    </TaskHeaderMenu>
  );
}
