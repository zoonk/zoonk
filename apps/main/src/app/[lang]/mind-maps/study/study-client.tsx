"use client";

import { sawAppWrites, takeSettledAppWrites } from "@/lib/http/app-write-ledger";
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
  /** Which of the learner's writes the server read behind this copy saw (`sawAppWrites`). */
  writeVersion: number;
};

function StudyVisit({ deck, goalId, lessons, saved, start, view, writeVersion }: StudyProps) {
  const actions = useMindMapActions(goalId);
  const router = useRouter();
  const pathname = usePathname();

  // The deck stays as it opens, so it opens only from a copy that saw the learner's writes.
  const [opened, setOpened] = useState(() => sawAppWrites(writeVersion));

  if (!opened && sawAppWrites(writeVersion)) {
    setOpened(true);
  }

  const readAgainIfWritten = useEffectEvent(async () => {
    if (await takeSettledAppWrites({ to: pathname })) {
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
    if (opened) {
      return;
    }

    const timer = setTimeout(() => setOpened(true), READ_AGAIN_PATIENCE_MS);
    return () => clearTimeout(timer);
  }, [opened]);

  if (!opened) {
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
