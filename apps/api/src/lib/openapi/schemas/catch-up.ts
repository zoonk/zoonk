import { z } from "zod";

/** Catching up on lessons earlier days left: what Today's session says about it. */
export const catchUpSchema = z
  .object({
    blockIds: z
      .array(z.uuid())
      .meta({ description: "The day's blocks that catch up: label them so" }),
    later: z
      .object({ lessons: z.number().int().min(0), minutes: z.number().int().min(0) })
      .meta({
        description:
          "Lessons to catch up on that the day's normal time doesn't fit: offer adding them to today (POST catch-up-blocks), or they come first on the next days",
      }),
    lessonsLeft: z.number().int().min(1),
  })
  .nullable()
  .meta({
    description:
      "Catching up on lessons earlier days left, which the day opens with; null when the learner is on pace",
  });
