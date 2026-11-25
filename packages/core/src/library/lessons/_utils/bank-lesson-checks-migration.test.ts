import { readFileSync } from "node:fs";
import { type Item, prisma } from "@zoonk/db";
import { attemptFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { libraryStepFixture, stepVariantFixture } from "@zoonk/testing/fixtures/library-steps";
import { skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { parseItemContent } from "../../items/item-content";

describe("lesson check bank migration", () => {
  it("creates a parseable item and links history only for checks that always served the base", async () => {
    const [lesson, skill, user] = await Promise.all([
      libraryLessonFixture({ contentStatus: "completed" }),
      skillFixture(),
      userFixture(),
    ]);

    const content = {
      basis: null,
      options: [
        { id: "a", isCorrect: false, reason: "A whole contains two halves.", text: "A. Three" },
        { id: "b", isCorrect: true, reason: "Two equal parts make the whole.", text: "B. Two" },
      ],
      question: "How many halves make a whole?",
    };

    const [base, varied] = await Promise.all(
      [0, 1].map((position) =>
        libraryStepFixture({
          content,
          kind: "check",
          lessonId: lesson.id,
          position,
          skillId: skill.id,
        }),
      ),
    );

    if (!base || !varied) {
      throw new Error("Expected both fixture checks");
    }

    const [, baseAttempt, variantAttempt, mistake] = await Promise.all([
      stepVariantFixture({ content, key: "excel", kind: "tool", stepId: varied.id }),
      attemptFixture({ stepId: base.id, userId: user.id }),
      attemptFixture({ stepId: varied.id, userId: user.id }),
      mistakeFixture({ skillId: skill.id, stepId: base.id, userId: user.id }),
    ]);

    const migration = readFileSync(
      new URL(
        "../../../../../db/src/prisma/migrations/20261125104708_bank_lesson_checks/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );

    const dataStatements = migration.slice(migration.indexOf("UPDATE attempts SET from_lesson"));

    await prisma.$transaction(async (tx) => {
      // Shadow the migration's tables so it only touches the fixtures in this test.
      await tx.$executeRaw`CREATE TEMP TABLE skills ON COMMIT DROP AS SELECT * FROM public.skills WHERE id = ${skill.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE library_lessons ON COMMIT DROP AS SELECT * FROM public.library_lessons WHERE id = ${lesson.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE library_steps ON COMMIT DROP AS SELECT * FROM public.library_steps WHERE lesson_id = ${lesson.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE step_variants ON COMMIT DROP AS SELECT * FROM public.step_variants WHERE step_id = ${varied.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE library_step_option_pictures ON COMMIT DROP AS SELECT * FROM public.library_step_option_pictures WHERE false`;
      await tx.$executeRaw`CREATE TEMP TABLE attempts ON COMMIT DROP AS SELECT * FROM public.attempts WHERE user_id = ${user.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE mistakes ON COMMIT DROP AS SELECT * FROM public.mistakes WHERE user_id = ${user.id}::uuid`;
      await tx.$executeRaw`CREATE TEMP TABLE items (LIKE public.items INCLUDING DEFAULTS) ON COMMIT DROP`;

      for (const statement of dataStatements.split(";").filter((part) => part.trim())) {
        // oxlint-disable-next-line no-await-in-loop -- The migration classifies old attempts before it links them.
        await tx.$executeRawUnsafe(statement);
      }

      const [linked] = await tx.$queryRaw<{ itemId: string }[]>`
        SELECT item_id AS "itemId" FROM library_steps WHERE id = ${base.id}::uuid`;

      const [item] = await tx.$queryRaw<Pick<Item, "content" | "format">[]>`
        SELECT content, CASE WHEN format = 'multiple_choice' THEN 'multipleChoice' END AS format
        FROM items WHERE id = ${linked?.itemId}::uuid`;

      if (!linked || !item) {
        throw new Error("The migration did not bank the base check");
      }

      expect(parseItemContent(item)).toStrictEqual({
        content: {
          context: null,
          fixedOrder: false,
          image: null,
          options: [
            {
              isCorrect: false,
              misconception: null,
              reason: content.options[0]?.reason,
              text: "Three",
            },
            {
              isCorrect: true,
              misconception: null,
              reason: content.options[1]?.reason,
              text: "Two",
            },
          ],
          question: content.question,
          select: 1,
          visual: null,
        },
        format: "multipleChoice",
      });

      await expect(tx.$queryRaw`
        SELECT id, from_lesson AS "fromLesson", item_id AS "itemId" FROM attempts
      `).resolves.toStrictEqual(
        expect.arrayContaining([
          { fromLesson: true, id: baseAttempt.id, itemId: linked.itemId },
          { fromLesson: true, id: variantAttempt.id, itemId: null },
        ]),
      );

      await expect(
        tx.$queryRaw`SELECT id, item_id AS "itemId" FROM mistakes`,
      ).resolves.toStrictEqual([{ id: mistake.id, itemId: linked.itemId }]);
    });
  });
});
