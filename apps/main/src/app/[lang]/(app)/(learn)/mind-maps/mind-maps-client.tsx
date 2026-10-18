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

/** A goal's mind maps, made through the public API when the learner taps for one. */
export function MindMapsClient({
  cap,
  goalId,
  mindMaps,
  next,
}: {
  /** The cap of the learner's plan their maps already reached (`getReachedCap`), or null. */
  cap: MindMapLimit | null;
  goalId: string;
  mindMaps: GoalMindMapsView;
  /** The plan's next chapter, whose map comes first while there's none yet. */
  next: NextMindMap | null;
}) {
  const actions = useMindMapActions(goalId);

  return (
    <MindMapsScreen actions={actions} cap={cap} hrefs={HREFS} mindMaps={mindMaps} next={next} />
  );
}
