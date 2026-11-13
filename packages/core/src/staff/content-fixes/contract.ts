import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { FIX_HANDLERS } from "./handlers/registry";

/**
 * A typo repeated across a lesson's screens fits, and an approver can still read every row's
 * before and after in one sitting; a bigger rewrite is a new version of the lesson, not a fix.
 */
const MAX_CONTENT_FIX_CHANGES = 10;

const MAX_REASON_LENGTH = 2000;

const idSchema = uuidSchema();
const reasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);

const proposedChangeSchema = z
  .looseObject({ id: idSchema, model: z.string() })
  .meta({ description: "{ model, id, <operation> }; pnpm zoonk staff models lists each model's" });

export const contentFixProposalSchema = z
  .strictObject({
    changes: z.array(proposedChangeSchema).min(1).max(MAX_CONTENT_FIX_CHANGES),
    feedbackId: idSchema.optional().meta({ description: "The learner report this fix answers" }),
    reason: reasonSchema.meta({ description: "Why the content is wrong, in the proposer's words" }),
  })
  .meta({ id: "ContentFixProposal" });

export const contentFixRevertSchema = z
  .strictObject({ fixId: idSchema, reason: reasonSchema })
  .meta({ id: "ContentFixRevert" });

const storedChangeSchema = z.union(FIX_HANDLERS.map((handler) => handler.stored));

export type StoredChange = z.infer<typeof storedChangeSchema>;

/** `ContentFix.changes`: what the server read before each change and what it writes. */
export const contentFixChangesSchema = z
  .array(storedChangeSchema)
  .meta({ id: "ContentFixChanges" });

const screenModelSchema = z.enum(["Step", "StepVariant"]);

const effectSchema = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("lessonVersion"), lessonId: idSchema })
    .meta({ description: "Learners who open the lesson next get the fixed version" }),
  z
    .object({ count: z.int(), kind: z.literal("answerExplanationsDeleted"), stepId: idSchema })
    .meta({ description: "Explanations of wrong answers written from the old screen are deleted" }),
  z
    .object({ id: idSchema, kind: z.literal("answerKeyChanged"), model: screenModelSchema })
    .meta({ description: "Which answer counts as right changes" }),
  z
    .object({ id: idSchema, kind: z.literal("questionChanged"), model: screenModelSchema })
    .meta({ description: "The question or options learners read change" }),
  z
    .object({ kind: z.literal("marksKept"), lessonId: idSchema })
    .meta({ description: "The lesson's idea marks, icons and maps stay as they were drawn" }),
  z
    .object({ kind: z.literal("screenLeftOut"), stepId: idSchema })
    .meta({ description: "A question about the detached numbered picture is no longer asked" }),
  z
    .object({ itemId: idSchema, kind: z.literal("itemRetired") })
    .meta({ description: "New practice skips the item; what already holds it keeps it" }),
  z
    .object({ itemId: idSchema, kind: z.literal("itemRestored") })
    .meta({ description: "New practice can pick the item again" }),
  z
    .object({
      id: idSchema,
      kind: z.literal("slugKept"),
      model: z.enum(["Course", "Chapter", "Lesson"]),
    })
    .meta({ description: "The title changes but the address keeps its old slug" }),
]);

export type ContentFixEffect = z.infer<typeof effectSchema>;

/** `ContentFix.effects`: what approving also does. */
export const contentFixEffectsSchema = z.array(effectSchema).meta({ id: "ContentFixEffects" });
