import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { z } from "zod";

/**
 * A typo repeated across a lesson's screens fits, and an approver can still read every row's
 * before and after in one sitting; a bigger rewrite is a new version of the lesson, not a fix.
 */
const MAX_CONTENT_FIX_CHANGES = 10;

const MAX_REASON_LENGTH = 2000;

const SET_MODELS = [
  "Course",
  "Chapter",
  "Lesson",
  "Step",
  "StepVariant",
  "AnswerExplanation",
] as const;

const idSchema = uuidSchema();
const setModelSchema = z.enum(SET_MODELS);
const reasonSchema = z.string().trim().min(1).max(MAX_REASON_LENGTH);

const setChangeSchema = z.strictObject({
  id: idSchema,
  model: setModelSchema,
  set: z
    .record(z.string(), z.json())
    .refine((fields) => Object.keys(fields).length > 0, { message: "Set at least one field" })
    .meta({ description: "Each field's whole new value" }),
});

const retireChangeSchema = z.strictObject({
  id: idSchema,
  model: z.literal("Item"),
  retire: z.literal(true),
});

const detachPictureChangeSchema = z.strictObject({
  detachPicture: z.literal(true),
  id: idSchema,
  model: z.literal("Step"),
});

const proposedChangeSchema = z.union([
  setChangeSchema,
  retireChangeSchema,
  detachPictureChangeSchema,
]);

/** Only reverting a retired question or a detached picture builds these; the CLI can't send them. */
type InverseChange =
  | { id: string; model: "Item"; unretire: true }
  | { attachPicture: string; id: string; model: "Step" };

export type ProposedChange = z.infer<typeof proposedChangeSchema> | InverseChange;

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

const fieldChangeSchema = z.object({ after: z.json(), before: z.json(), field: z.string() });

const pictureChange = { id: idSchema, mediaAssetId: idSchema, model: z.literal("Step") };

const storedChangeSchema = z.discriminatedUnion("op", [
  z.object({
    fields: z.array(fieldChangeSchema).min(1),
    id: idSchema,
    model: setModelSchema,
    op: z.literal("set"),
  }),
  z.object({ id: idSchema, model: z.literal("Item"), op: z.literal("retire") }),
  z.object({
    id: idSchema,
    model: z.literal("Item"),
    op: z.literal("unretire"),
    retiredAt: z.iso.datetime(),
  }),
  z.object({ ...pictureChange, op: z.literal("detachPicture") }),
  z.object({
    ...pictureChange,
    op: z.literal("attachPicture"),
    pictureRemovedAt: z.iso.datetime(),
  }),
]);

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
