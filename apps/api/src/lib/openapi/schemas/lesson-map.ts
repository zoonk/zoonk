import { lessonMapSchema } from "@zoonk/core/library/lessons/map";

export const lessonMapResponseSchema = lessonMapSchema.meta({
  description: "A small map of what the lesson teaches: its ideas, each in one complete sentence",
  id: "LessonMap",
});
