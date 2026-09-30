"use client";

import { MainAskTutor } from "@/components/learn/main-ask-tutor";
import { useGoToStudyDestination } from "@/lib/session/use-study-navigation";
import { type ChapterView } from "@zoonk/core/view-models/chapter/contract";
import { type ChapterHrefs, ChapterScreen } from "@zoonk/learn/chapter";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { useMemo } from "react";
import { practiceAreaAction } from "../../../progress/practice-area-action";

const CHAPTER_HREFS: ChapterHrefs = {
  back: "/content",
  lessonBasePath: "/learn",
  mistakes: "/mistakes",
};

/**
 * A chapter's page with "Practice" wired to today's session in the learner's timezone and "Ask"
 * for questions about the chapter.
 */
export function ChapterScreenClient({
  canAsk,
  chapter,
}: {
  canAsk: boolean;
  chapter: ChapterView;
}) {
  const go = useGoToStudyDestination();
  const { chapterId } = chapter.chapter;
  const target = useMemo(() => ({ chapterId, kind: "chapter" as const }), [chapterId]);

  const practice = async () => {
    const result = await practiceAreaAction(chapter.goal.id, {
      areaId: chapter.chapter.chapterId,
      timeZone: getLocalTimeZone(),
    });

    if (result.outcome === "started") {
      await go(result.destination);
    }

    return result.outcome;
  };

  return (
    <ChapterScreen
      actions={{ practice }}
      ask={<MainAskTutor canAsk={canAsk} target={target} />}
      chapter={chapter}
      hrefs={CHAPTER_HREFS}
    />
  );
}
