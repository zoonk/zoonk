import { sql } from "@zoonk/db";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { z } from "zod";
import { collectionHandler } from "./collection-handler";

/** A course left with none would be filed again by the course details writer, so it keeps one. */
const categoriesSchema = z
  .array(z.enum(COURSE_CATEGORIES))
  .min(1)
  .refine((categories) => new Set(categories).size === categories.length, {
    message: "Each category appears once.",
  })
  .transform((categories) => categories.toSorted());

export const courseCategories = collectionHandler({
  load: async (db, id) => {
    const row = await db.course.findUnique({
      select: { categories: { select: { category: true } }, userId: true, visibility: true },
      where: { id },
    });

    return (
      row && {
        before: row.categories.map((category) => category.category).toSorted(),
        problem:
          row.userId || row.visibility !== "public"
            ? "Only a public course with no owner is in the catalog."
            : undefined,
        roots: {},
        unit: { id, kind: "course" },
      }
    );
  },
  model: "Course",
  op: "setCategories",
  rules: `{ setCategories: [category, ...] } files a public course in the catalog under these categories, at least one: ${COURSE_CATEGORIES.join(", ")}.`,
  schema: categoriesSchema,
  table: sql`courses`,
  write: async (tx, id, after) => {
    const categories = categoriesSchema.parse(after);

    await tx.courseCategory.deleteMany({
      where: { category: { notIn: categories }, courseId: id },
    });

    await tx.courseCategory.createMany({
      data: categories.map((category) => ({ category, courseId: id })),
      skipDuplicates: true,
    });
  },
});
