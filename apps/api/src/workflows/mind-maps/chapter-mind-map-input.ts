import { type MindMapLaunch } from "@zoonk/core/mind-maps/request";
import { type ContentAnalytics } from "../_shared/content-analytics";

/** `lessons`: the chapter's lessons to write first, which the request that claimed the map charged. */
export type ChapterMindMapInput = {
  analytics?: ContentAnalytics;
  chapterId: string;
  redraw?: boolean;
  lessons?: { forExam: boolean; ids: string[] };
};

export function getChapterMindMapToken(chapterId: string): string {
  return `mind-map:${chapterId}`;
}

/** The run a request that claimed the map starts, from a tap or an owed follow-up alike. */
export function toChapterMindMapInput({
  chapterId,
  launch,
}: {
  chapterId: string;
  launch: MindMapLaunch;
}): ChapterMindMapInput {
  return {
    analytics: launch.analytics,
    chapterId,
    lessons: { forExam: launch.forExam, ids: launch.lessonIds },
  };
}
