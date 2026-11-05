import { z } from "zod";
import { lessonIconSchema } from "../icons/lesson-icon-contract";

export const stepMarksSchema = z
  .object({
    example: z
      .string()
      .nullable()
      .meta({
        description:
          "Whole sentences of the screen's marked text to frame as its example: an exact substring of it, markup included, so splitting the text around it never cuts a run of markup. Null when the screen has none",
      }),
    icon: lessonIconSchema,
    ideaIndex: z
      .int()
      .min(0)
      .nullable()
      .meta({
        description:
          "The lesson map idea the screen belongs to, as an index into `summary.ideas` from 0. Null when the lesson has no map or the screen belongs to none of its ideas",
      }),
    underline: z
      .string()
      .nullable()
      .meta({
        description:
          "The phrase that states the screen's main point, to underline: plain words found in the marked text once its `**` marks are removed, so look for it in the rendered text, where it may start, end or run through a bold term. Often null",
      }),
  })
  .nullable()
  .meta({
    description:
      "Light marks on a teaching screen. The marked text is an explanation's `text` or a worked example's `problem`; on other screens only `ideaIndex` is set. `icon` sits on the corner of the example's frame, or of the text block when there's no example, only on an explanation with no picture, visual or activity of its own. Null until the lesson is tagged, and on screens it never tags",
    id: "StepMarks",
  });

/** Nullable as a named schema, so strict clients decode its references without an `allOf`. */
export type StepMarks = NonNullable<z.infer<typeof stepMarksSchema>>;
