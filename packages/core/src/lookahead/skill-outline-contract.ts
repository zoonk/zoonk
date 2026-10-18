import { z } from "zod";

const skillOutlineChapterSchema = z
  .object({
    chapterId: z
      .uuid()
      .meta({ description: "Its page is `GET /v1/goals/{goalId}/chapters/{chapterId}`" }),
    title: z.string(),
  })
  .meta({ id: "SkillOutlineChapter" });

/**
 * A topic of the plan beyond the weeks its lessons are written for ahead: its chapters once its
 * course outlined them, or whether they're being written or can be asked for now.
 */
export const skillOutlineSchema = z
  .object({
    chapters: z
      .array(skillOutlineChapterSchema)
      .meta({ description: "The chapters that teach the topic, in its course's order" }),
    status: z
      .enum(["available", "writing", "ready"])
      .meta({
        description:
          "`ready`: its chapters exist. `writing`: its course's outline is being written, or was just asked for; read it again every few seconds (about half a minute for the first chapter). `available`: nothing is written yet; POST `/goals/{goalId}/skills/{skillId}/outline/generations` writes it now, or the plan writes it as it gets close",
      }),
  })
  .meta({ id: "SkillOutline" });

export type SkillOutline = z.infer<typeof skillOutlineSchema>;
