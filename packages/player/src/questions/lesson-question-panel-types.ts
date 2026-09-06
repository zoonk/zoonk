import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";

export type LessonQuestionPanelMetadata = {
  chapterTitle: string;
  courseTitle: string;
  lessonDescription: string;
  lessonSteps: SerializedStep[];
  lessonTitle: string;
};
