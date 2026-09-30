"use client";

import { type LearnBuddy, LearnNavigation, type LearnTab } from "@zoonk/learn/navigation";
import { useSelectedLayoutSegment } from "next/navigation";

/**
 * The tab each route marks. The stats pages live under Progress, in their own route group, and
 * Fun's dock buddy stands for the buddy's page and the progress behind it.
 */
const TAB_SEGMENTS: Record<string, LearnTab> = {
  "(stats)": "progress",
  buddy: "progress",
  content: "content",
  plan: "plan",
  progress: "progress",
  today: "today",
};

/**
 * The tabs or the dock, with the current route's tab marked. Pages inside the group that aren't
 * tabs (such as the mistakes notebook) mark none.
 */
export function LearnTabNavigation({ buddy }: { buddy: LearnBuddy | null }) {
  const segment = useSelectedLayoutSegment();
  const activeTab = segment ? (TAB_SEGMENTS[segment] ?? null) : null;

  return <LearnNavigation activeTab={activeTab} buddy={buddy} />;
}
