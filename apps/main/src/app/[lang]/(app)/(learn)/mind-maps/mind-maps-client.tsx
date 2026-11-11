"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type GoalMindMapsView } from "@zoonk/core/mind-maps/contract";
import { MindMapsScreen } from "@zoonk/learn/mind-maps";

export function MindMapsClient({
  goalId,
  mindMaps,
  plus,
}: {
  goalId: string;
  mindMaps: GoalMindMapsView;
  plus: boolean;
}) {
  const actions = useMindMapActions(goalId);

  return <MindMapsScreen actions={actions} backHref="/plan" mindMaps={mindMaps} plus={plus} />;
}
