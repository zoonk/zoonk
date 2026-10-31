"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import {
  type MindMapLimit,
  type MindMapsHrefs,
  MindMapsScreen,
  type NextMindMap,
} from "@zoonk/learn/mind-maps";

const HREFS: MindMapsHrefs = {
  back: "/plan",
  chapter: (chapterId) => `/content/chapters/${chapterId}`,
  today: "/today",
};

export function MindMapsClient({
  cap,
  goalId,
  mindMaps,
  next,
}: {
  cap: MindMapLimit | null;
  goalId: string;
  mindMaps: GoalMindMapsView;
  next: NextMindMap | null;
}) {
  const actions = useMindMapActions(goalId);

  return (
    <MindMapsScreen actions={actions} cap={cap} hrefs={HREFS} mindMaps={mindMaps} next={next} />
  );
}
