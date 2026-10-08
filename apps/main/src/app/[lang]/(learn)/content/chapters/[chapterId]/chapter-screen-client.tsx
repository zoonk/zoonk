"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { type ChapterHrefs, ChapterScreen } from "@zoonk/learn/chapter";
import { LessonRichText } from "@zoonk/player/lesson/rich-text";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { practiceAreaAction } from "./chapter-actions";

const CHAPTER_HREFS: ChapterHrefs = { back: "/journey", lessonBasePath: "/learn" };

/** Back to the subject the chapter was opened from, by its name, instead of the Journey. */
type ChapterBack = { href: string; label: string };

/**
 * A chapter's page with "Practice" wired to today's session in the learner's timezone, "Take the
 * test" asking for the test-out's questions and opening it, and "Ask" for questions about it.
 */
export function ChapterScreenClient({
  back,
  chapter,
  mindMap,
  tutor,
}: {
  back: ChapterBack | null;
  chapter: ChapterView;
  /** The chapter's mind map (`getChapterMindMap`), made from its summary once it's finished. */
  mindMap: ChapterMindMapView | null;
  /** Who asks and the buddy who answers (`getTutorViewer`). */
  tutor: TutorViewer;
}) {
  const go = useGoToStudyDestination();
  const startTestOut = useStartTestOut();
  const mindMapActions = useMindMapActions(chapter.goal.id);
  const { chapterId } = chapter.chapter;
  const target = useMemo(() => ({ chapterId, kind: "chapter" as const }), [chapterId]);

  const practice = async () => {
    const result = await practiceAreaAction(chapter.goal.id, {
      areaId: chapterId,
      timeZone: getLocalTimeZone(),
    });

    if (result.outcome === "started") {
      await go(result.destination);
    }

    return result.outcome;
  };

  return (
    <ChapterScreen
      actions={{
        practice,
        startTestOut: () => startTestOut({ chapterId, goalId: chapter.goal.id }),
      }}
      ask={<MainAskTutor {...tutor} size="bar" target={target} />}
      chapter={chapter}
      hrefs={back ? { ...CHAPTER_HREFS, back: back.href, backLabel: back.label } : CHAPTER_HREFS}
      mindMap={mindMap && { actions: mindMapActions, view: mindMap }}
      renderLessonText={(text) => <LessonRichText text={text} />}
    />
  );
}
