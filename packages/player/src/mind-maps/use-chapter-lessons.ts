"use client";

import { useEffect, useRef, useState } from "react";
import { type DeckSlide, type LessonMindMap } from "./mind-map-deck";

/** A chapter's lesson maps, or null when they couldn't be read. */
export type LoadLessonMaps = (chapterId: string) => Promise<LessonMindMap[] | null>;

export type ChapterLessons = Readonly<Record<string, LessonMindMap[] | "failed">>;

async function readLessonMaps({
  chapterId,
  load,
  onRead,
}: {
  chapterId: string;
  load: LoadLessonMaps;
  onRead: (update: (current: ChapterLessons) => ChapterLessons) => void;
}) {
  const lessons = await load(chapterId).catch(() => null);
  onRead((current) => ({ ...current, [chapterId]: lessons ?? "failed" }));
}

/**
 * Lesson maps come a chapter at a time: the shown map's chapter and the ones a turn away are read
 * as the learner gets near them, so the next map is there when they turn to it.
 */
export function useChapterLessons({
  deck,
  index,
  load,
  loaded,
}: {
  deck: readonly DeckSlide[];
  index: number;
  load: LoadLessonMaps;
  loaded: ChapterLessons;
}) {
  const [lessons, setLessons] = useState(loaded);
  const asked = useRef(new Set(Object.keys(loaded)));

  const near = [index - 1, index, index + 1]
    .flatMap((position) => deck[position] ?? [])
    .flatMap((slide) => (slide.kind === "lesson" ? [slide.chapterId] : []));

  const nearKey = [...new Set(near)].join(",");

  useEffect(() => {
    nearKey
      .split(",")
      .filter((chapterId) => chapterId && !asked.current.has(chapterId))
      .forEach((chapterId) => {
        asked.current.add(chapterId);
        void readLessonMaps({ chapterId, load, onRead: setLessons });
      });
  }, [load, nearKey]);

  return {
    lessons,
    retry: (chapterId: string) => {
      setLessons(({ [chapterId]: _failed, ...others }) => others);
      void readLessonMaps({ chapterId, load, onRead: setLessons });
    },
  };
}
