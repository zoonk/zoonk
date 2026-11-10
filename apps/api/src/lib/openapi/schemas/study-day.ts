import { studyBlockSchema } from "@zoonk/core/sessions/block-view-contract";
import { missionSchema } from "@zoonk/core/sessions/completion-contract";
import { dayBlockRefSchema } from "@zoonk/core/sessions/day-block";
import { z } from "zod";
import { catchUpSchema } from "./catch-up";
import { planDaySchema } from "./plans";
import { studySessionResponseSchema } from "./study-sessions";

const nonBlockDestinations = missionSchema.shape.opens
  .unwrap()
  .options.filter((option) => option.shape.kind.value !== "block");

const previewMissionOpensSchema = z
  .union([z.object({ kind: z.literal("block"), ref: dayBlockRefSchema }), ...nonBlockDestinations])
  .optional();

const previewMissionSchema = missionSchema
  .omit({ opens: true })
  .extend({ opens: previewMissionOpensSchema });

const unstartedStudyDayResponseSchema = studySessionResponseSchema
  .omit({ blocks: true, catchUp: true, id: true, missions: true, nextBlockId: true, status: true })
  .extend({
    blocks: z.array(studyBlockSchema.omit({ id: true })),
    catchUp: catchUpSchema.unwrap().omit({ blockIds: true }).nullable(),
    missions: z.array(previewMissionSchema),
    status: z.literal("unstarted"),
  })
  .meta({ id: "UnstartedStudyDay" });

export const studyDayResponseSchema = z
  .discriminatedUnion("status", [studySessionResponseSchema, unstartedStudyDayResponseSchema])
  .meta({
    description: "A saved authoritative session or the read-only unopened preview",
    id: "StudyDay",
  });

export const planRevealTodayResponseSchema = z
  .object({
    minutes: z
      .int()
      .min(0)
      .meta({
        description:
          "The minutes of what `today` lists, from its blocks' estimates: show it beside Today's date",
      }),
    nextDays: z
      .array(planDaySchema)
      .meta({
        description:
          "The six days after today, composed with `today` so each lesson shows once: a lesson the plan laid out today that `today` leaves out (reviews took its time) comes first tomorrow, a lesson `today` lists isn't repeated, and a lesson split across days shows on its first day. A day with time but nothing left to list isn't included; a rest day is, with no items. Draw them as given",
      }),
    today: studyDayResponseSchema,
    week: z
      .object({ days: z.int().min(0), minutes: z.int().min(0) })
      .meta({
        description:
          "The first week's study days, today among them when `today` lists something, and their time a day added up: the first week's header",
      }),
  })
  .meta({ id: "PlanRevealToday" });
