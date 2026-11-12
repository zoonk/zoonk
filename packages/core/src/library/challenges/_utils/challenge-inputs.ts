import "server-only";
import { type ChallengeCaseParams } from "@zoonk/ai/tasks/challenge/schema";
import { type Lesson } from "@zoonk/db";
import { type ChallengeLessonSpec } from "../challenge-lesson-spec";

export type ChallengeCaseInputs = Omit<
  ChallengeCaseParams,
  "analytics" | "model" | "problems" | "speed"
>;

type ChallengeLesson = Pick<Lesson, "language" | "level" | "title"> & {
  homeChapter: {
    description: string | null;
    homeCourse: { title: string } | null;
    title: string;
  } | null;
};

export function toChallengeCaseInputs({
  lesson,
  spec,
}: {
  lesson: ChallengeLesson;
  spec: ChallengeLessonSpec;
}): ChallengeCaseInputs {
  const chapter = lesson.homeChapter;

  return {
    chapterDescription: chapter?.description ?? null,
    chapterTitle: chapter?.title ?? lesson.title,
    courseTitle: chapter?.homeCourse?.title ?? chapter?.title ?? lesson.title,
    language: lesson.language,
    level: lesson.level,
    skills: spec.skills,
    variant: spec.variant,
  };
}
