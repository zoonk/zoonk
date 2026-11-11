"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type MindMapTab, buildMindMapsHref } from "@zoonk/learn/mind-maps/urls";
import { type DeckSlide, type LessonMindMap } from "@zoonk/player/mind-maps/deck";
import { MindMapReader } from "@zoonk/player/mind-maps/reader";

export function MindMapStudyClient({
  deck,
  goalId,
  lessons,
  start,
  view,
}: {
  deck: DeckSlide[];
  goalId: string;
  lessons: Record<string, LessonMindMap[]>;
  start: number;
  view: MindMapTab;
}) {
  const actions = useMindMapActions(goalId);

  return (
    <MindMapReader
      actions={actions}
      deck={deck}
      goalId={goalId}
      hrefs={{
        chapter: "/content/chapters",
        exit: buildMindMapsHref({ page: "/mind-maps", tab: view }),
        lesson: "/learn",
      }}
      lessons={lessons}
      start={start}
      view={view}
    />
  );
}
