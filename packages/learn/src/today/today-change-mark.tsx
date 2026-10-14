"use client";

import { NOTICE_SOURCE } from "@zoonk/core/plans/change-contract";
import { REBALANCE_SOURCE } from "@zoonk/core/preparation/rebalance";
import { type TodayView } from "@zoonk/core/view-models/today/get";
import {
  CalendarClockIcon,
  FastForwardIcon,
  FileClockIcon,
  type LucideIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  ScaleIcon,
} from "lucide-react";

type Change = NonNullable<TodayView["planChange"]>;

/** The icons of the changes that have one of their own; the rest share the plan's. */
const KIND_ICONS: Partial<Record<string, LucideIcon>> = {
  missedDays: CalendarClockIcon,
  relearn: RotateCcwIcon,
  testedOut: FastForwardIcon,
};

function getChangeIcon(change: Change): LucideIcon {
  if (change.source === NOTICE_SOURCE) {
    return FileClockIcon;
  }

  return (
    KIND_ICONS[change.kind] ?? (change.source === REBALANCE_SOURCE ? ScaleIcon : RefreshCwIcon)
  );
}

/** A change's own icon, as the notice's mark. */
function ChangeIcon({ icon: Icon }: { icon: LucideIcon }) {
  return <Icon />;
}

/**
 * The mark of a plan change on Today: a suggestion takes the amber sparkle (none of its own); a
 * change the exam's notice brings, or one already made, its own icon.
 */
export function getChangeMark(change: Change): React.ReactNode {
  const suggestion = change.status === "proposed" && change.source !== NOTICE_SOURCE;
  return suggestion ? undefined : <ChangeIcon icon={getChangeIcon(change)} />;
}
