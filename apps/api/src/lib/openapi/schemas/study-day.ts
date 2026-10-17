import { missionSchema } from "@zoonk/core/sessions/completion-contract";
import { dayBlockRefSchema } from "@zoonk/core/sessions/day-block";
import { z } from "zod";
import { catchUpSchema } from "./catch-up";
import { studyBlockSchema, studySessionResponseSchema } from "./study-sessions";

const nonBlockDestinations = missionSchema.shape.opens
  .unwrap()
  .options.filter((option) => option.shape.kind.value !== "block");

const previewMissionOpensSchema = z
  .union([z.object({ kind: z.literal("block"), ref: dayBlockRefSchema }), ...nonBlockDestinations])
  .optional();

const previewMissionSchema = missionSchema
  .omit({ opens: true })
  .extend({ opens: previewMissionOpensSchema });

/** An unopened day has the same display fields and logical work, with no invented persisted IDs. */
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
