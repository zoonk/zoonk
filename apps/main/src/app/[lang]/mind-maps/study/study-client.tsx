"use client";

import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type MindMapTab, buildMindMapsHref } from "@zoonk/learn/mind-maps/urls";
import { type DeckSlide, type LessonMindMap } from "@zoonk/player/mind-maps/deck";
import { MindMapReader } from "@zoonk/player/mind-maps/reader";
import { useRouter } from "next/navigation";

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
  const { bfcacheId } = useRouter();

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
      // The router keeps a left page alive: each tap on Study opens a fresh deck, while Back
      // returns to the map the learner was on.
      key={bfcacheId}
      lessons={lessons}
      start={start}
      view={view}
    />
  );
}
