import { z } from "zod";

/** Catching up on lessons earlier days left: what Today's session says about it. */
export const catchUpSchema = z
  .object({
    blockIds: z
      .array(z.uuid())
      .meta({ description: "The day's blocks that catch up: label them so" }),
    later: z
      .object({
        lessons: z.number().int().min(0),
        minutes: z.number().int().min(0),
        offered: z
          .boolean()
          .meta({
            description:
              "They take about one more day's time at most: offer adding them to today (POST catch-up-blocks). Otherwise say only that they come first on the next days",
          }),
      })
      .meta({
        description:
          "Lessons to catch up on that the day's normal time doesn't fit: they come first on the next days (none when examTomorrow), or join today on a tap while offered",
      }),
    lessonsLeft: z.number().int().min(1),
    positions: z.array(z.number().int().nonnegative()),
  })
  .nullable()
  .meta({
    description:
      "Catching up on lessons earlier days left, which the day opens with; null when the learner is on pace, on a fresh start (a fresh start carries no backlog) and when a free exam plan's first week has ended",
  });
