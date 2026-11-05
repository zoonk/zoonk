import { z } from "zod";

export const lessonIconSchema = z
  .object({
    smallUrl: z
      .string()
      .meta({ description: "96 px square WebP, for small spots such as the maps and the strip" }),
    url: z.string().meta({ description: "256 px square WebP, for the corner of a text block" }),
  })
  .meta({
    description:
      "A small drawing in the lesson's house style, with a white sticker border baked in, so one file works in light and dark. Decorative: screen readers skip it, since the text beside it says the same",
    id: "LessonIcon",
  });

export type LessonIcon = z.infer<typeof lessonIconSchema>;
