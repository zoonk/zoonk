import { z } from "zod";

export const lessonIconSchema = z
  .object({
    smallUrl: z
      .string()
      .meta({ description: "96 px square WebP, for small spots such as the maps and the strip" }),
    url: z.string().meta({ description: "256 px square WebP, for the corner of a text block" }),
  })
  .nullable()
  .meta({
    description:
      "A small drawing in the lesson's house style, with a white sticker border baked in, so one file works in light and dark. Decorative: screen readers skip it, since the text beside it says the same. Null until it's drawn",
    id: "LessonIcon",
  });

/** Nullable as a named schema, so strict clients decode its references without an `allOf`. */
export type LessonIcon = NonNullable<z.infer<typeof lessonIconSchema>>;
