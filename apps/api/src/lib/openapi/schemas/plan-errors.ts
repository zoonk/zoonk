import { unfundedMoveSchema } from "@zoonk/core/plans/plan-error-contract";
import { z } from "zod";
import { errorSchema } from "./common";

/** A refused plan edit, with recovery data when a mock's new day cannot fund it. */
const planChangeInvalidErrorSchema = errorSchema
  .extend({
    error: errorSchema.shape.error.extend({
      code: z.literal("PLAN_CHANGE_INVALID"),
      details: z.object({
        reason: z
          .string()
          .describe(
            "Why the change was refused. mockCollision means two weekly events would share a day: the requested day already holds a weekly challenge or mock, another move in the plan or the request takes an event there, or the event already moved once. Preserve the prior plan and pick another day. baseChoiceClosed means a setBaseChoices choice isn't in that base's choices (a studied base is open only to deep study): offer only its choices. Preserve unknown reasons.",
          ),
        unfundedMove: unfundedMoveSchema
          .optional()
          .describe(
            "Present for reason unfundedMove: the requested calendar day and the mock's real duration. The prior plan is preserved. Ask the learner to pick a later day.",
          ),
      }),
    }),
  })
  .meta({ id: "PlanChangeInvalidError" });

export const planChangeInvalidResponse = {
  content: { "application/json": { schema: planChangeInvalidErrorSchema } },
  description:
    "The change cannot apply and the prior plan is unchanged. For mockCollision, two weekly events would share the day: pick another day. For unfundedMove, details.unfundedMove gives the requested day and real mock duration it cannot fund: pick a later day.",
} as const;

/** One refused date: where it was sent, and its nearest accepted calendar bound. */
const outOfRangeDateSchema = z.object({
  bound: z
    .enum(["earliest", "latest"])
    .describe(
      "earliest: before tomorrow; latest: after calendar day 3,650. Preserve unknown bounds.",
    ),
  limit: z.iso.date().describe("The nearest accepted bound, to offer instead"),
  message: z.string(),
  path: z
    .array(z.union([z.string(), z.number()]))
    .describe("Where the refused date was sent in the request body"),
});

/** A new target date outside the supported range (`TARGET_DATE_OUT_OF_RANGE`). */
const targetDateOutOfRangeErrorSchema = errorSchema
  .extend({
    error: errorSchema.shape.error.extend({
      code: z.literal("TARGET_DATE_OUT_OF_RANGE"),
      details: z.array(outOfRangeDateSchema),
    }),
  })
  .meta({ id: "TargetDateOutOfRangeError" });

const TARGET_DATE_OUT_OF_RANGE_DESCRIPTION =
  "TARGET_DATE_OUT_OF_RANGE: a new goal's explicit target date is before tomorrow or after calendar day 3,650 from the learner's today; existing plan edits use this code for the upper bound only and keep their prior past-date refusal. Nothing was saved. details[].bound and details[].limit give the refused bound and nearest accepted date.";

export const targetDateOutOfRangeResponse = {
  content: { "application/json": { schema: targetDateOutOfRangeErrorSchema } },
  description: TARGET_DATE_OUT_OF_RANGE_DESCRIPTION,
} as const;

/** A plan change refused by the plan (`PLAN_CHANGE_INVALID`) or for a date past what it reaches. */
export const planDateChangeInvalidResponse = {
  content: {
    "application/json": {
      schema: z.union([planChangeInvalidErrorSchema, targetDateOutOfRangeErrorSchema]),
    },
  },
  description: `PLAN_CHANGE_INVALID: ${planChangeInvalidResponse.description} ${TARGET_DATE_OUT_OF_RANGE_DESCRIPTION}`,
} as const;
