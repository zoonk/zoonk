"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { type MindMapLimit, type MindMapsHrefs, MindMapsScreen } from "@zoonk/learn/mind-maps";

const HREFS: MindMapsHrefs = {
  back: "/plan",
  chapter: (chapterId) => `/content/chapters/${chapterId}`,
  today: "/today",
};

export function MindMapsClient({
  cap,
  goalId,
  mindMaps,
}: {
  cap: MindMapLimit | null;
  goalId: string;
  mindMaps: GoalMindMapsView;
}) {
  const actions = useMindMapActions(goalId);

  return <MindMapsScreen actions={actions} cap={cap} hrefs={HREFS} mindMaps={mindMaps} />;
}
