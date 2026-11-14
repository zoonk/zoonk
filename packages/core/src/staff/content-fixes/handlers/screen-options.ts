import { isDeepStrictEqual } from "node:util";
import { type TransactionClient, sql } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { z } from "zod";
import { type Json, type Resolution, refuse, toJson } from "../_utils/resolved-change";
import { defineFixHandler, fieldChangeSchema, idSchema } from "./fix-handler";
import { prepareOptions } from "./option-collections";
import { screenSelect } from "./screens";

type Model = "Step" | "StepVariant";
const pictureSchema = z.object({ mediaAssetId: idSchema, optionId: z.string() });

const storedSchema = <ModelName extends Model>(model: ModelName) =>
  z.object({
    fields: z.array(fieldChangeSchema),
    id: idSchema,
    mintedIds: z.array(z.string()),
    model: z.literal(model),
    op: z.literal("setOptions"),
    pictures: z.array(pictureSchema),
    restorePictures: z.array(pictureSchema),
  });

async function loadScreen(db: TransactionClient, model: Model, id: string) {
  const variant =
    model === "StepVariant"
      ? await db.stepVariant.findUnique({
          select: { content: true, step: { select: screenSelect }, stepId: true },
          where: { id },
        })
      : null;

  const step =
    model === "Step"
      ? await db.step.findUnique({ select: { ...screenSelect, content: true }, where: { id } })
      : variant?.step;

  const before = model === "Step" && step && "content" in step ? step.content : variant?.content;

  return step && before !== undefined
    ? { before: toJson(before), step, stepId: variant?.stepId ?? id }
    : null;
}

function optionsHandler<ModelName extends Model>(model: ModelName) {
  type Stored = z.infer<ReturnType<typeof storedSchema<ModelName>>>;

  type Proposed = {
    id: string;
    setOptions: { content: Json };
    allowedIds?: string[];
    restorePictures?: Stored["pictures"];
  };

  async function resolve(db: TransactionClient, proposed: Proposed): Promise<Resolution<Stored>> {
    const loaded = await loadScreen(db, model, proposed.id);

    if (!loaded) {
      return refuse(`No ${model} with id ${proposed.id}.`);
    }

    const { before, step, stepId } = loaded;

    if (step.staged || step.retiredAt || step.itemId) {
      return refuse("Only a current screen without a bank Item supports setOptions.");
    }

    const result = prepareOptions(
      step.kind,
      toJson(before),
      proposed.setOptions.content,
      proposed.allowedIds ?? [],
    );

    if ("problem" in result) {
      return refuse(result.problem ?? "Invalid options.");
    }

    if (model === "Step" && isDeepStrictEqual(before, result.after)) {
      return refuse("These options are already stored.");
    }

    const restoredAssets = proposed.restorePictures?.map((picture) => picture.mediaAssetId) ?? [];

    const available = await db.mediaAsset.count({
      where: { id: { in: [...new Set(restoredAssets)] }, visibility: "public" },
    });

    if (available !== new Set(restoredAssets).size) {
      return refuse("An option picture's asset no longer exists or is not public.");
    }

    const [pictures, explanations, tutorAnswers] = await Promise.all([
      model === "Step"
        ? db.stepOptionPicture.findMany({
            select: { mediaAssetId: true, optionId: true },
            where: { optionId: { in: result.removedIds }, stepId },
          })
        : [],
      db.answerExplanation.count({ where: { stepId } }),
      db.tutorSharedAnswer.count({ where: { stepId } }),
    ]);

    return {
      effects: [
        { id: proposed.id, kind: "answerKeyChanged", model },
        { kind: "marksKept", lessonId: step.lessonId },
        ...(pictures.length > 0
          ? [{ count: pictures.length, kind: "optionPicturesUnlinked" as const, stepId }]
          : []),
        ...(explanations
          ? [{ count: explanations, kind: "answerExplanationsDeleted" as const, stepId }]
          : []),
        ...(tutorAnswers
          ? [{ count: tutorAnswers, kind: "tutorAnswersDeleted" as const, stepId }]
          : []),
      ],
      ok: true,
      stored: {
        fields: [{ after: result.after, before: toJson(before), field: "content" }],
        id: proposed.id,
        mintedIds: [...new Set([...result.mintedIds, ...(proposed.allowedIds ?? [])])],
        model,
        op: "setOptions",
        pictures,
        restorePictures: proposed.restorePictures ?? [],
      },
      unit: { id: step.lessonId, kind: "lesson" },
    };
  }

  return defineFixHandler({
    apply: async (tx, stored) => {
      const content = stored.fields[0]?.after;

      if (!isJsonObject(content)) {
        throw new Error("Missing screen content");
      }

      const updated =
        model === "Step"
          ? await tx.step.update({ data: { content }, where: { id: stored.id } })
          : await tx.stepVariant.update({ data: { content }, where: { id: stored.id } });

      const stepId = "stepId" in updated ? updated.stepId : updated.id;

      await tx.answerExplanation.deleteMany({ where: { stepId } });
      await tx.tutorSharedAnswer.deleteMany({ where: { stepId } });

      if (model === "Step") {
        await tx.stepOptionPicture.deleteMany({
          where: { optionId: { in: stored.pictures.map((picture) => picture.optionId) }, stepId },
        });

        await tx.stepOptionPicture.createMany({
          data: stored.restorePictures.map((picture) => ({ ...picture, stepId })),
        });
      }
    },
    model,
    op: "setOptions",
    proposal: {
      rules:
        "Send { setOptions: { content } } with the whole screen. Kept options change only isCorrect; new options omit id. Include every variant with setOptions in the same fix. Picture-option additions are unsupported.",
      schema: z.strictObject({
        id: idSchema,
        model: z.literal(model),
        setOptions: z.strictObject({ content: z.json() }),
      }),
    },
    resolve,
    revert: (db, stored) => {
      const content = stored.fields[0]?.before ?? null;
      const groups = isJsonObject(content) ? collectContentIds(content) : [];

      return resolve(db, {
        allowedIds: groups,
        id: stored.id,
        restorePictures: stored.pictures,
        setOptions: { content },
      });
    },
    stored: storedSchema(model),
    table: model === "Step" ? sql`library_steps` : sql`step_variants`,
    targets: ({ id }) => [{ id, model, part: "content" }],
    toProposed: (stored) => ({
      allowedIds: stored.mintedIds,
      id: stored.id,
      restorePictures: stored.restorePictures,
      setOptions: { content: stored.fields[0]?.after ?? null },
    }),
  });
}

function collectContentIds(value: Json): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectContentIds(entry));
  }

  if (!isJsonObject(value)) {
    return [];
  }

  return [
    ...(typeof value.id === "string" ? [value.id] : []),
    ...Object.values(value).flatMap((entry) => collectContentIds(entry)),
  ];
}

export const stepSetOptions = optionsHandler("Step");
export const variantSetOptions = optionsHandler("StepVariant");
