import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const saveLessonSchema = z.object({ lessonId: uuidSchema(), saved: z.boolean() }).strict();

export type SaveLessonInput = z.infer<typeof saveLessonSchema>;

export const savedLessonSchema = z
  .object({
    available: z.boolean().meta({ description: "The lesson is available to start" }),
    chapterTitle: z.string().nullable(),
    lessonId: uuidSchema(),
    title: z.string().meta({ description: "The current title if available, or the title at save" }),
  })
  .meta({ id: "SavedLesson" });

export type SavedLesson = z.infer<typeof savedLessonSchema>;

export const savedLessonListSchema = z
  .object({ lessons: z.array(savedLessonSchema) })
  .meta({ id: "SavedLessonList" });
