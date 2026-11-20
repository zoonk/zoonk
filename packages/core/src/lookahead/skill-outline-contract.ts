import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

const skillOutlineChapterSchema = z
  .object({
    chapterId: uuidSchema().meta({
      description: "Its page is `GET /v1/goals/{goalId}/chapters/{chapterId}`",
    }),
    title: z.string(),
  })
  .meta({ id: "SkillOutlineChapter" });

export const skillOutlineSchema = z
  .object({
    chapters: z
      .array(skillOutlineChapterSchema)
      .meta({ description: "The chapters that teach the topic, in its course's order" }),
    status: z
      .enum(["available", "writing", "ready"])
      .meta({
        description:
          "`ready`: its chapters exist. `writing`: the learner asked for it and it's being written; read it again every few seconds (about half a minute for the first chapter), and it's `ready` once written or `available` again if that ended without its chapters. `available`: nothing is written yet; POST `/goals/{goalId}/skills/{skillId}/outline/generations` writes it now, or the plan writes it as it gets close",
      }),
  })
  .meta({ id: "SkillOutline" });

export type SkillOutline = z.infer<typeof skillOutlineSchema>;
