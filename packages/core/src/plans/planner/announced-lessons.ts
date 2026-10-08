import { toAnnouncedStems } from "../../library/exams/material-formats";
import { toStems } from "../../library/exams/topic-key";
import { type PlannerLesson } from "./plan-units";

/**
 * The lessons on what a class test's announced questions ask ("uma dissertativa sobre osmose":
 * "Osmose em células animais e vegetais"): each word of what a question is about marks the lessons
 * whose title has it, when those lessons all teach one skill. A word several skills' lessons share
 * ("célula") says nothing about which one the question asks. A plan short on time keeps these
 * lessons with their skill's core (see `putCoresFirst`): Pedro's 30-minute plan cut the osmosis
 * lesson his teacher announced an essay on, after the skill's first lesson.
 */
export function findAnnouncedLessonIds({
  announcements,
  lessons,
}: {
  /** What the questions the learner's material announces are, as its formats describe them. */
  announcements: readonly string[];
  lessons: readonly PlannerLesson[];
}): Set<string> {
  const titled = lessons.map((lesson) => ({ lesson, stems: new Set(toStems(lesson.title)) }));
  const stems = new Set(announcements.flatMap((description) => toAnnouncedStems(description)));

  return new Set(
    [...stems].flatMap((stem) => {
      const named = titled.filter((entry) => entry.stems.has(stem)).map((entry) => entry.lesson);
      const skills = new Set(named.flatMap((lesson) => lesson.skillIds));

      return skills.size === 1 ? named.map((lesson) => lesson.lessonId) : [];
    }),
  );
}
