"use client";

import { useLayoutEffect, useState } from "react";
import { type PlanEditorSection } from "../plan/plan-editor-sections";
import { type GoalStatusChange, type GoalStatusControl, useSetGoalStatus } from "./goal-actions";

export function useGoalMenu(control: GoalStatusControl | null) {
  const [archiving, setArchiving] = useState(false);
  const [resuming, setResuming] = useState(false);
  const { setStatus } = useSetGoalStatus(control?.onSetStatus ?? null);
  const resumePreview = control?.resume ?? false;

  const archive = () => {
    setArchiving(false);
    setStatus("archived");
  };

  const resume = () => {
    setResuming(false);
    setStatus("active");
  };

  const onSetStatus = (status: GoalStatusChange) => {
    if (status === "active" && resumePreview) {
      setResuming(true);
      return;
    }

    setStatus(status);
  };

  const goal = control && { control, onArchive: () => setArchiving(true), onSetStatus };

  return { archive, archiving, goal, resume, resumePreview, resuming, setArchiving, setResuming };
}

export function usePlanEditor(arrival: boolean | PlanEditorSection) {
  const at = typeof arrival === "string" ? arrival : null;
  const arrived = { open: arrival !== false, section: at };
  const [editor, setEditor] = useState<typeof arrived | null>(null);

  // Activity keeps state while the page hides, so a later arrival starts from its requested view.
  useLayoutEffect(() => () => setEditor(null), []);

  return {
    editor: editor ?? arrived,
    open: (section: PlanEditorSection | null = null) => setEditor({ open: true, section }),
    setOpen: (open: boolean) => setEditor({ open, section: (editor ?? arrived).section }),
  };
}
