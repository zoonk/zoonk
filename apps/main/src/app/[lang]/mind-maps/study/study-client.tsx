"use client";

import { hasUntakenAppWrites, takeSettledAppWrites } from "@/lib/http/app-write-ledger";
import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { type SavedMapTarget } from "@zoonk/learn/mind-maps/saves";
import { type MindMapTab, buildMindMapsHref } from "@zoonk/learn/mind-maps/urls";
import { type DeckSlide, type LessonMindMap } from "@zoonk/player/mind-maps/deck";
import { MindMapReader } from "@zoonk/player/mind-maps/reader";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useState } from "react";
import { StudySkeleton } from "./study-skeleton";

/** Past this, the page's read is likely lost, so the learner studies the copy they have. */
const READ_AGAIN_PATIENCE_MS = 5000;

type StudyProps = {
  deck: DeckSlide[];
  goalId: string;
  lessons: Record<string, LessonMindMap[]>;
  saved: SavedMapTarget[];
  start: number;
  view: MindMapTab;
};

function StudyVisit({ deck, goalId, lessons, saved, start, view }: StudyProps) {
  const actions = useMindMapActions(goalId);
  const router = useRouter();
  const pathname = usePathname();

  // The deck stays as it opens, so a copy older than the learner's writes waits for the next read.
  const [olderDeck, setOlderDeck] = useState(() =>
    hasUntakenAppWrites({ to: pathname }) ? deck : null,
  );

  if (olderDeck && olderDeck !== deck) {
    setOlderDeck(null);
  }

  const waiting = olderDeck !== null;

  const readAgainIfWritten = useEffectEvent(async () => {
    if ((await takeSettledAppWrites({ to: pathname })) || waiting) {
      router.refresh();
    }
  });

  // The router opens Study from its copy of a visit up to five minutes old, which can predate the
  // learner's writes. `RefreshStalePages` reads only the frame's pages again, so Study does so here
  // each time it shows.
  useEffect(() => {
    void readAgainIfWritten();
  }, []);

  useEffect(() => {
    if (!waiting) {
      return;
    }

    const timer = setTimeout(() => setOlderDeck(null), READ_AGAIN_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  if (waiting) {
    return <StudySkeleton />;
  }

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
      saved={saved}
      start={start}
      view={view}
    />
  );
}

export function MindMapStudyClient(props: StudyProps) {
  const { bfcacheId } = useRouter();

  // The router keeps a left page alive: each tap on Study opens a fresh deck, while Back returns to
  // the map the learner was on.
  return <StudyVisit key={bfcacheId} {...props} />;
}
