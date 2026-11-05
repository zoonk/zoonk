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
    icon: lessonIconSchema
      .nullable()
      .meta({
        description:
          "Shown on the corner of the example's frame, or of the text block when there's no example. Only on an explanation with no picture, visual or activity of its own, and null until it's drawn",
      }),
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
          "The phrase that states the screen's main point, to underline: an exact substring of the marked text, in plain words with no markup inside, so it reads the same in the rendered text. Often null",
      }),
  })
  .meta({
    description:
      "Light marks on a teaching screen. The marked text is an explanation's `text` or a worked example's `problem`; on other screens only `ideaIndex` is set. Null until the lesson is tagged, and on screens it never tags",
    id: "StepMarks",
  });

export type StepMarks = z.infer<typeof stepMarksSchema>;
