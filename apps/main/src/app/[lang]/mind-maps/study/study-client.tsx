"use client";

import { takeSettledAppWrites } from "@/lib/http/app-write-ledger";
import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type SavedMapTarget } from "@zoonk/learn/mind-maps/saves";
import { type MindMapTab, buildMindMapsHref } from "@zoonk/learn/mind-maps/urls";
import { type DeckSlide, type LessonMindMap } from "@zoonk/player/mind-maps/deck";
import { MindMapReader } from "@zoonk/player/mind-maps/reader";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent } from "react";

export function MindMapStudyClient({
  deck,
  goalId,
  lessons,
  saved,
  start,
  view,
}: {
  deck: DeckSlide[];
  goalId: string;
  lessons: Record<string, LessonMindMap[]>;
  saved: SavedMapTarget[];
  start: number;
  view: MindMapTab;
}) {
  const actions = useMindMapActions(goalId);
  const router = useRouter();
  const { bfcacheId } = router;
  const pathname = usePathname();

  const readAgainIfWritten = useEffectEvent(async () => {
    if (await takeSettledAppWrites({ to: pathname })) {
      router.refresh();
    }
  });

  // The router opens Study from its copy of a visit up to five minutes old, which can predate the
  // learner's saves. `RefreshStalePages` reads only the frame's pages again, so Study does so here
  // each time it shows.
  useEffect(() => {
    void readAgainIfWritten();
  }, []);

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
      saved={saved}
      start={start}
      view={view}
    />
  );
}
