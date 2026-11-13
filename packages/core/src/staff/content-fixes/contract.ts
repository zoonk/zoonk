import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";
import { MAX_BATCH_FIXES } from "./batches";
import { FIX_HANDLERS } from "./handlers/registry";

/**
 * A review bound on what one fix asks the approver to read, not on what it depends on: a unit that
 * must change several rows together carries them all.
 */
const MAX_CONTENT_FIX_CHANGES = 10;

const MAX_REASON_LENGTH = 2000;

const idSchema = uuidSchema();
const reasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);
const feedbackSchema = idSchema.meta({ description: "The learner report this fix answers" });

const changesSchema = z
  .array(
    z
      .looseObject({ id: idSchema, model: z.string() })
      .meta({ description: "{ model, id, <operation> }, as pnpm zoonk staff models lists them" }),
  )
  .min(1)
  .max(MAX_CONTENT_FIX_CHANGES);

const batchFixSchema = z.strictObject({
  changes: changesSchema,
  feedbackId: feedbackSchema.optional(),
  reason: reasonSchema.optional().meta({ description: "This fix's own reason, if it differs" }),
});

export const contentFixProposalSchema = z
  .strictObject({
    changes: changesSchema.optional().meta({ description: "One fix's changes" }),
    feedbackId: feedbackSchema.optional(),
    fixes: z
      .array(batchFixSchema)
      .min(1)
      .max(MAX_BATCH_FIXES)
      .optional()
      .meta({ description: "A batch: fixes reviewed and approved together, each applied alone" }),
    reason: reasonSchema.meta({ description: "Why the content is wrong, in the proposer's words" }),
  })
  .refine((proposal) => (proposal.changes === undefined) !== (proposal.fixes === undefined), {
    message: "Send changes for one fix or fixes for a batch, not both.",
  })
  .meta({ id: "ContentFixProposal" });

export const contentFixRevertSchema = z
  .strictObject({
    batchId: idSchema.optional().meta({ description: "Revert every applied fix of this batch" }),
    fixId: idSchema.optional(),
    reason: reasonSchema,
  })
  .refine((revert) => (revert.batchId === undefined) !== (revert.fixId === undefined), {
    message: "Name one fixId or one batchId.",
  })
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
    .object({ count: z.int(), kind: z.literal("tutorAnswersDeleted"), stepId: idSchema })
    .meta({ description: "Tutor answers shared from the old screen are deleted" }),
  z
    .object({ count: z.int(), kind: z.literal("variantsKept"), stepId: idSchema })
    .meta({
      description:
        "The screen's versions for a field or tool keep their content; set them in the fix to change them",
    }),
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
    .object({ count: z.int(), itemId: idSchema, kind: z.literal("itemExplanationsDeleted") })
    .meta({
      description: "Explanations of wrong answers written from the old question are deleted",
    }),
  z
    .object({ itemId: idSchema, kind: z.literal("itemReplaced"), replacementId: idSchema })
    .meta({
      description:
        "New practice asks the replacement; answers, history and mistakes stay with the retired original, whose mistakes no longer replay",
    }),
  z
    .object({
      answerKeys: z.array(z.string()),
      kind: z.literal("levelTestChanged"),
      questions: z.array(z.string()),
      speaking: z.array(z.string()),
    })
    .meta({
      description:
        "The level test questions whose words change, those whose right option changes, and the levels whose sentence to say changes",
    }),
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
