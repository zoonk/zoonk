import { type PublishedLessonScreen } from "@zoonk/ai/tasks/lesson-spec/activity-plan";
import { type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { type CourseLevel } from "@zoonk/db";
import lessons from "./published-lessons.json";

/** A Library lesson written before activities were common, as `pnpm zoonk staff lesson` read it. */
export type PublishedLesson = {
  chapterTitle: string;
  courseTitle: string;
  language: string;
  level: CourseLevel;
  screens: PublishedLessonScreen[];
  spec: LessonSpec;
};

const PUBLISHED = lessons as Record<string, PublishedLesson>;

export function publishedLesson(id: string): PublishedLesson {
  const lesson = PUBLISHED[id];

  if (!lesson) {
    throw new Error(`No published lesson ${id} in published-lessons.json`);
  }

  return lesson;
}

export const LESSON_IDS = {
  binarySearch: "01a1bc07-924d-7e56-a5e7-d49b6abb2e32",
  cppStructure: "01a21731-6277-775d-a41a-9eaea5ba5655",
  deMorgan: "01a1bbfe-6d8b-7c0f-be18-e38392977600",
  dnaStrands: "01a1d374-c0d5-7498-a279-8959a2d9a965",
  domSelection: "01a1c5ed-9d64-7bba-acf8-69be1f7b0541",
  informationAccessLaw: "01a1bc05-f4d5-7114-8b08-64bf5e85bb1d",
  moneyRecords: "01a19de3-62bc-7224-a9aa-7fbc239e7398",
  numericExpressions: "01a1d52e-a56b-750a-ab5e-76eb91a3a555",
  promises: "01a1bc07-9497-7920-9a63-2bcc5f9ee360",
  pythonValues: "01a1d52e-a545-7717-a7c3-2632ad313de3",
  solutionsInContext: "01a1a275-5f15-7b6e-b1a5-b53035943991",
} as const;
