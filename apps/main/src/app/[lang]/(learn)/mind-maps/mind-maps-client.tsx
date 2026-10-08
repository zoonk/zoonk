"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { type MindMapsHrefs, MindMapsScreen } from "@zoonk/learn/mind-maps";

const HREFS: MindMapsHrefs = {
  back: "/journey",
  chapter: (chapterId) => `/content/chapters/${chapterId}`,
  today: "/today",
};

/** A goal's mind maps, made through the public API when the learner taps for one. */
export function MindMapsClient({
  goalId,
  mindMaps,
}: {
  goalId: string;
  mindMaps: GoalMindMapsView;
}) {
  const actions = useMindMapActions(goalId);
  return <MindMapsScreen actions={actions} hrefs={HREFS} mindMaps={mindMaps} />;
}
