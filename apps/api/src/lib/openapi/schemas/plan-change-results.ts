import { ownLevelSchema } from "@zoonk/core/learner/placement/contract";
import { planChangeSchema } from "@zoonk/core/plans/change-contract";
import { type OwnLevelChange } from "@zoonk/core/plans/own-level-contract";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

export const ownLevelChangeSchema = z
  .object({
    change: planChangeSchema
      .nullable()
      .meta({
        description:
          "Lower levels: the foundations added before the skills they prepare for, with an undo; null when the plan already starts from them",
      }),
    direction: z.enum(["higher", "lower", "same"]),
    level: ownLevelSchema,
    testOuts: z
      .array(z.object({ chapterId: uuidSchema(), title: z.string() }))
      .meta({
        description:
          "Higher levels: chapters the new level covers, to test out of (GET /goals/{goalId}/chapters/{chapterId}/test-out); nothing is skipped until a test-out is passed",
      }),
  })
  .meta({ id: "OwnLevelChange" }) satisfies z.ZodType<OwnLevelChange>;

export const planChangeResultSchema = z
  .object({
    change: planChangeSchema
      .nullable()
      .meta({ description: "Null when the plan isn't built yet, or when nothing changed" }),
    reason: z
      .enum(["alreadyIn", "cantMove"])
      .nullable()
      .optional()
      .meta({
        description:
          "Why the change changed nothing (`unchanged`): `alreadyIn` (the plan already holds what it asks: the exam strategy it adds, or every lesson of the subjects it focuses on) or `cantMove` (the subjects it focuses on already start as early as what they build on allows, and more of them doesn't fit)",
      }),
    status: z
      .enum(["applied", "proposed", "unchanged"])
      .meta({
        description:
          "Proposed changes wait for the learner's OK: they move more than a lesson. `unchanged`: the change wouldn't do what it asks (the plan already holds the exam strategy it adds, focusing on subjects would leave the plan as it is, or more or less of some subjects would do the opposite in the plan the learner sees), so nothing was saved",
      }),
  })
  .meta({ id: "PlanChangeResult" });
