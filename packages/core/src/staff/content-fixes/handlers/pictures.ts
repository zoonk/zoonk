import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import { shouldOmitNumberedPicture } from "../../../lesson-player/picture-policy";
import { NOT_CURRENT_SCREEN, type Resolution, refuse } from "../_utils/resolved-change";
import { defineFixHandler, idSchema } from "./fix-handler";
import { screenSelect } from "./screens";

type PictureStored<Op extends "attachPicture" | "detachPicture"> = {
  id: string;
  mediaAssetId: string;
  model: "Step";
  op: Op;
};

/** Takes the picture off this screen alone; the drawing and its other screens keep it. */
async function resolvePictureDetach(
  db: TransactionClient,
  id: string,
): Promise<Resolution<PictureStored<"detachPicture">>> {
  const step = await db.step.findUnique({
    select: { ...screenSelect, content: true, mediaAssetId: true },
    where: { id },
  });

  if (!step) {
    return refuse(`No Step with id ${id}.`);
  }

  if (step.retiredAt || step.staged) {
    return refuse(NOT_CURRENT_SCREEN);
  }

  if (!step.mediaAssetId) {
    return refuse("This screen shows no picture to detach.");
  }

  const leftOut = shouldOmitNumberedPicture({
    content: step.content,
    imageAvailable: false,
    imagePending: false,
    kind: step.kind,
  });

  return {
    effects: leftOut ? [{ kind: "screenLeftOut", stepId: id }] : [],
    ok: true,
    stored: { id, mediaAssetId: step.mediaAssetId, model: "Step", op: "detachPicture" },
    unit: { id: step.lessonId, kind: "lesson" },
  };
}

/** Reverts a detached picture: the same drawing goes back while the screen still has none. */
async function resolvePictureAttach(
  db: TransactionClient,
  { id, mediaAssetId }: { id: string; mediaAssetId: string },
): Promise<Resolution<PictureStored<"attachPicture">>> {
  const [step, asset] = await Promise.all([
    db.step.findUnique({
      select: { ...screenSelect, mediaAssetId: true, pictureRemovedAt: true },
      where: { id },
    }),
    db.mediaAsset.findUnique({ select: { visibility: true }, where: { id: mediaAssetId } }),
  ]);

  if (!step) {
    return refuse(`No Step with id ${id}.`);
  }

  if (step.retiredAt || step.staged) {
    return refuse(NOT_CURRENT_SCREEN);
  }

  if (step.mediaAssetId || !step.pictureRemovedAt) {
    return refuse("This screen's picture is no longer detached.");
  }

  if (asset?.visibility !== "public") {
    return refuse("The picture this screen showed no longer exists.");
  }

  return {
    effects: [],
    ok: true,
    stored: { id, mediaAssetId, model: "Step", op: "attachPicture" },
    unit: { id: step.lessonId, kind: "lesson" },
  };
}

const pictureStored = <Op extends "attachPicture" | "detachPicture">(op: Op) =>
  z.object({ id: idSchema, mediaAssetId: idSchema, model: z.literal("Step"), op: z.literal(op) });

const pictureTarget = ({ id }: { id: string }) => [{ id, model: "Step", part: "picture" }];

export const stepAttachPicture = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    await tx.step.update({
      data: { mediaAssetId: stored.mediaAssetId, pictureAvailableAt: now, pictureRemovedAt: null },
      where: { id: stored.id },
    });
  },
  model: "Step",
  op: "attachPicture",
  resolve: (db, proposed: { id: string; mediaAssetId: string }) =>
    resolvePictureAttach(db, proposed),
  revert: (db, stored) => resolvePictureDetach(db, stored.id),
  stored: pictureStored("attachPicture"),
  table: sql`library_steps`,
  targets: pictureTarget,
  toProposed: ({ id, mediaAssetId }) => ({ id, mediaAssetId }),
});

export const stepDetachPicture = defineFixHandler({
  apply: async (tx, stored, { now }) => {
    await tx.step.update({
      data: { mediaAssetId: null, pictureAvailableAt: null, pictureRemovedAt: now },
      where: { id: stored.id },
    });
  },
  model: "Step",
  op: "detachPicture",
  proposal: {
    rules: "{ model: 'Step', id, detachPicture: true } takes the picture off this screen alone.",
    schema: z.strictObject({
      detachPicture: z.literal(true),
      id: idSchema,
      model: z.literal("Step"),
    }),
  },
  resolve: (db, proposed) => resolvePictureDetach(db, proposed.id),
  revert: (db, stored) =>
    resolvePictureAttach(db, { id: stored.id, mediaAssetId: stored.mediaAssetId }),
  stored: pictureStored("detachPicture"),
  table: sql`library_steps`,
  targets: pictureTarget,
  toProposed: ({ id }) => ({ detachPicture: true as const, id, model: "Step" as const }),
});
