import { type TransactionClient, sql } from "@zoonk/db";
import { z } from "zod";
import {
  getCourseEditionProblem,
  joinCourseEditionFamily,
  readCourseEditionPair,
} from "../../../courses/_utils/course-edition-family";
import { type Resolution, refuse } from "../_utils/resolved-change";
import { defineFixHandler, fieldChangeSchema, idSchema } from "./fix-handler";

const model = "Course";
type EditionOp = "linkEdition" | "unlinkEdition";

const stored = z.object({
  detachIds: z.array(idSchema).optional(),
  editionFamilyId: idSchema.nullable(),
  editionId: idSchema,
  fields: z.array(fieldChangeSchema),
  id: idSchema,
  model: z.literal(model),
  op: z.enum(["linkEdition", "unlinkEdition"]),
  sourceFamilyId: idSchema.nullable(),
});

type Link = { detachIds?: string[]; editionId: string; id: string };

async function resolve(
  db: TransactionClient,
  { detachIds, editionId, id }: Link,
  op: EditionOp = "linkEdition",
): Promise<Resolution<z.infer<typeof stored>>> {
  const pair = await readCourseEditionPair(db, { courseId: id, editionId });

  if (!pair || id === editionId) {
    return refuse("Both courses must exist.");
  }

  const { course, edition } = pair;
  const sameFamily = course.familyId !== null && course.familyId === edition.familyId;

  if (detachIds) {
    if (!course.familyId || !sameFamily) {
      return refuse("The courses no longer share a family.");
    }

    await db.$queryRaw`SELECT id FROM course_families WHERE id = ${course.familyId}::uuid FOR NO KEY UPDATE`;

    const members = await db.course.count({ where: { familyId: course.familyId } });

    if (detachIds.length === 2 && members !== 2) {
      return refuse("The family gained editions after the link was applied.");
    }
  } else {
    const problem = await getCourseEditionProblem(db, pair);

    if (problem || sameFamily) {
      return refuse(problem ?? "The courses are already editions of each other.");
    }
  }

  return {
    effects: [],
    ok: true,
    stored: {
      ...(detachIds && { detachIds }),
      editionFamilyId: edition.familyId,
      editionId,
      fields: [
        {
          after: detachIds ? null : editionId,
          before: detachIds ? editionId : null,
          field: "edition",
        },
      ],
      id,
      model,
      op,
      sourceFamilyId: course.familyId,
    },
    unit: { id, kind: "course" },
  };
}

function editionHandler(op: EditionOp) {
  return defineFixHandler({
    apply: async (tx, { detachIds, editionId, id }) => {
      if (detachIds) {
        await tx.$executeRaw`UPDATE plans p SET graph = p.graph - 'editionCandidate' FROM goals g
        WHERE p.goal_id = g.id AND p.graph ? 'editionCandidate'
          AND ((g.source_course_id = ${id}::uuid AND g.primary_course_id = ${editionId}::uuid)
            OR (g.source_course_id = ${editionId}::uuid AND g.primary_course_id = ${id}::uuid))`;

        await tx.course.updateMany({ data: { familyId: null }, where: { id: { in: detachIds } } });
        return;
      }

      const pair = await readCourseEditionPair(tx, { courseId: id, editionId });

      if (!pair) {
        throw new Error("The locked course edition pair is missing.");
      }

      await joinCourseEditionFamily(tx, pair);
    },
    lockIds: ({ editionId, id }) => [id, editionId],
    model,
    op,
    proposal: {
      rules:
        op === "unlinkEdition"
          ? "{ unlinkEdition: courseId } removes the named edition from the source course’s family."
          : "{ linkEdition: courseId } joins two public, published, ownerless courses with different content languages and the same target language and format. Courses in different families cannot be joined.",
      schema:
        op === "unlinkEdition"
          ? z
              .strictObject({ id: idSchema, model: z.literal(model), unlinkEdition: idSchema })
              .transform(({ id, unlinkEdition }) => ({
                detachIds: [unlinkEdition],
                editionId: unlinkEdition,
                id,
              }))
          : z
              .strictObject({ id: idSchema, linkEdition: idSchema, model: z.literal(model) })
              .transform(({ id, linkEdition }) => ({ editionId: linkEdition, id })),
    },
    resolve: (db, link: Link) => resolve(db, link, op),
    revert: (db, change) =>
      resolve(db, {
        detachIds: change.detachIds
          ? undefined
          : [
              ...(change.sourceFamilyId ? [] : [change.id]),
              ...(change.editionFamilyId ? [] : [change.editionId]),
            ],
        editionId: change.editionId,
        id: change.id,
      }),
    stored,
    table: sql`courses`,
    targets: ({ editionId, id }) =>
      [id, editionId].map((courseId) => ({ id: courseId, model, part: "familyId" })),
    toProposed: ({ detachIds, editionId, id }): Link => ({ detachIds, editionId, id }),
  });
}

export const courseEditions = editionHandler("linkEdition");
export const unlinkEdition = editionHandler("unlinkEdition");
