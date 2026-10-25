"use client";

import { NOTICE_SOURCE } from "@zoonk/core/plans/change-contract";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import { FileClockIcon } from "lucide-react";

type Change = NonNullable<TodayView["planChange"]>;

/**
 * The mark of a suggestion on Today: one the exam's notice brings takes the notice's icon; any
 * other takes the amber sparkle (none of its own).
 */
export function getChangeMark(change: Change): React.ReactNode {
  return change.source === NOTICE_SOURCE ? <FileClockIcon /> : undefined;
}
