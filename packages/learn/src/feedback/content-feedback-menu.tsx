"use client";

import { type FeedbackTarget } from "@zoonk/core/feedback/contract";
import { DetailMenu } from "@zoonk/ui/components/detail";
import { useEffect, useId } from "react";
import { TaskHeaderMenu } from "../_components/task-header";
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
  size?: "detail" | "icon" | "icon-bar";
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

  if (size !== "detail") {
    return (
      <TaskHeaderMenu className="w-60" label={label} onOpenChange={onOpenChange} size={size}>
        <ReportProblemItem screen={screen} target={target} />
      </TaskHeaderMenu>
    );
  }

  return (
    <DetailMenu label={label} onOpenChange={onOpenChange}>
      <ReportProblemItem screen={screen} target={target} />
    </DetailMenu>
  );
}

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
