"use client";

import { MainAskTutor, type TutorViewer } from "@/components/learn/main-ask-tutor";
import { useMindMapActions } from "@/lib/mind-maps/use-mind-map-actions";
import { answerHere, openingHere } from "@/lib/session/tap-answer";
import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { useStartTestOut } from "@/lib/test-out/use-start-test-out";
import { type ChapterMindMapView } from "@zoonk/core/mind-maps/contract";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { type AreaPracticeOutcome, type ChapterHrefs, ChapterScreen } from "@zoonk/learn/chapter";
import { type MindMapLimit } from "@zoonk/learn/mind-maps";
import { LessonRichText } from "@zoonk/player/lesson/rich-text";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { practiceAreaAction } from "./chapter-actions";

const CHAPTER_HREFS: ChapterHrefs = { back: "/plan", lessonBasePath: "/learn" };

type ChapterBack = { href: string; label: string };

export function ChapterScreenClient({
  back,
  chapter,
  mindMap,
  mindMapCap,
  tutor,
}: {
  back: ChapterBack | null;
  chapter: ChapterView;
  mindMap: ChapterMindMapView | null;
  mindMapCap: MindMapLimit | null;
  tutor: TutorViewer;
}) {
  const go = useGoToStudyDestination();
  const startTestOut = useStartTestOut();
  const mindMapActions = useMindMapActions(chapter.goal.id);
  const { chapterId } = chapter.chapter;
  const target = useMemo(() => ({ chapterId, kind: "chapter" as const }), [chapterId]);

  const practice = async (): Promise<AreaPracticeOutcome> => {
    const here = openingHere();

    const practiced = await answerHere(
      practiceAreaAction(chapter.goal.id, { areaId: chapterId, timeZone: getLocalTimeZone() }),
      here,
    );

    if (typeof practiced === "boolean") {
      return practiced ? "started" : "failed";
    }

    const { answer } = practiced;

    if (answer.outcome === "started") {
      await go(answer.destination, { here });
    }

    return answer.outcome;
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
      mindMap={mindMap && { actions: mindMapActions, cap: mindMapCap, view: mindMap }}
      renderLessonText={(text) => <LessonRichText text={text} />}
    />
  );
}
