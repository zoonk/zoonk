"use client";

import { useState } from "react";
import { type PlanEditFocus } from "./plan-edit-panel";

/** The edit panel's state, shared by the controls that open it. */
export function usePlanEdit() {
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState<PlanEditFocus>("schedule");

  const openAt = (target: PlanEditFocus) => {
    setFocus(target);
    setOpen(true);
  };

  return { focus, open, openAt, setOpen };
}
