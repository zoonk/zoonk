import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { lessonMapSchema } from "../library/lessons/lesson-map";

const lessonMindMapSchema = z
  .object({
    lessonId: uuidSchema(),
    locked: z.boolean().meta({ description: "Always false. Lesson maps do not expire" }),
    map: lessonMapSchema.nullable().meta({ description: "Null while `locked`" }),
    position: z.int().min(1).meta({ description: "The lesson's number in its chapter" }),
    saved: z.boolean().meta({ description: "The learner saved this map to study again" }),
    title: z.string().meta({ description: "The lesson's title" }),
  })
  .meta({ id: "LessonMindMap" });

export const chapterLessonMapsSchema = z
  .object({
    chapter: z.object({
      id: uuidSchema(),
      position: z.int().min(1).meta({ description: "As `ChapterMindMap.position`" }),
      title: z.string(),
    }),
    lessons: z
      .array(lessonMindMapSchema)
      .meta({
        description:
          "Every lesson of the chapter with a written map, studied or not, in chapter order; its challenge isn't one",
      }),
  })
  .meta({ id: "ChapterLessonMaps" });

export type ChapterLessonMapsView = z.infer<typeof chapterLessonMapsSchema>;
