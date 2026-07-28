import { z } from "zod";

export const coursePathParamsSchema = z
  .object({ courseId: z.uuid().meta({ description: "Course ID" }) })
  .meta({ id: "CoursePathParams" });

export const chapterPathParamsSchema = z
  .object({ chapterId: z.uuid().meta({ description: "Chapter ID" }) })
  .meta({ id: "ChapterPathParams" });

export const lessonPathParamsSchema = z
  .object({ lessonId: z.uuid().meta({ description: "Lesson ID" }) })
  .meta({ id: "LessonPathParams" });

export const generationPathParamsSchema = z
  .object({ generationId: z.string().trim().min(1).meta({ description: "Generation ID" }) })
  .meta({ id: "GenerationPathParams" });
