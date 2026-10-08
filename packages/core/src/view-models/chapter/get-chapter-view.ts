import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { loadGoalMap } from "../_utils/goal-map";
import { resolveViewGoal } from "../_utils/resolve-view-goal";
import { loadChapterNumbering } from "../syllabus/_utils/chapter-numbers";
import { findChapterArea } from "./_utils/chapter-area";
import {
  buildChapterLessons,
  buildChapterSummaries,
  loadChapterLessons,
} from "./_utils/chapter-lessons";
import { type ChapterView } from "./chapter-contract";

export type ChapterViewResult =
  | { chapter: ChapterView; status: "ready" }
  | { status: "noGoal" | "notFound" | "unauthorized" };

/** The skills the learner has answered at least once, which sessions count as studied. */
async function loadStudiedSkills({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  const rows = await prisma.learnerSkill.findMany({
    select: { skillId: true },
    where: { reps: { gt: 0 }, skillId: { in: skillIds }, userId },
  });

  return new Set(rows.map((row) => row.skillId));
}

/**
 * A chapter of the learner's plan (the active goal by default): its map of skills with mastery,
 * its lessons with the next one to open, open mistakes on its skills and the summary cards its
 * finished lessons left. Every chapter a plan item points at has one; a chapter outside the goal's
 * plan isn't found.
 */
export async function getChapterView({
  chapterId,
  goalId,
}: {
  chapterId: string;
  goalId?: string;
}): Promise<ChapterViewResult> {
  "use cache: private";

  const resolved = await resolveViewGoal(goalId);

  if (resolved.status !== "ready") {
    return resolved;
  }

  const { goal } = resolved;
  const map = isUuid(chapterId) ? await loadGoalMap({ goal }) : null;
  const area = map ? findChapterArea({ chapterId, map }) : null;

  if (!map || !area) {
    return { status: "notFound" };
  }

  const [chapter, lessons, numbering] = await Promise.all([
    prisma.chapter.findFirst({
      select: { id: true, level: true, title: true },
      where: { ...libraryRowsVisibleTo(goal.userId), id: chapterId },
    }),
    loadChapterLessons(chapterId),
    loadChapterNumbering(goal),
  ]);

  if (!chapter) {
    return { status: "notFound" };
  }

  const skillIds = [
    ...new Set([
      ...area.skills.map((skill) => skill.skillId),
      ...lessons.flatMap((lesson) => lesson.skillIds),
    ]),
  ];

  const [studied, openMistakes] = await Promise.all([
    loadStudiedSkills({ skillIds, userId: goal.userId }),
    prisma.mistake.count({
      where: { skillId: { in: skillIds }, status: "open", userId: goal.userId },
    }),
  ]);

  const lessonStates = buildChapterLessons({ chapterId, items: map.items, lessons, studied });
  const number = numbering({ chapterId, planPosition: area.position });

  return {
    chapter: {
      chapter: {
        chapterId: chapter.id,
        level: chapter.level,
        position: number.position,
        state: area.state,
        subject: number.subject,
        title: chapter.title,
      },
      counts: area.counts,
      goal: { id: goal.id, kind: goal.kind, title: goal.title },
      lessons: lessonStates,
      mistakes: { open: openMistakes },
      skills: area.skills,
      summaries: buildChapterSummaries({ lessons, states: lessonStates }),
    },
    status: "ready",
  };
}
