import { sql } from "@zoonk/db";
import { attemptFixture } from "@zoonk/testing/fixtures/learner";
import { itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { loadAnswerPerItem } from "./answer-per-item";

const ANSWERS_PER_ITEM = 6;
const MINUTE = 60_000;

describe(loadAnswerPerItem, () => {
  it.each(["first", "last"] as const)(
    "reads only the %s answer to each item, however often it was answered",
    async (order) => {
      const [user, skill] = await Promise.all([userFixture(), skillFixture()]);

      const items = await Promise.all([
        itemFixture({ skillId: skill.id }),
        itemFixture({ skillId: skill.id }),
      ]);

      const start = Date.now() - ANSWERS_PER_ITEM * MINUTE;

      await Promise.all(
        items.flatMap((item) =>
          Array.from({ length: ANSWERS_PER_ITEM }, (_, index) =>
            attemptFixture({
              answeredAt: new Date(start + index * MINUTE),
              isCorrect: index === 0,
              itemId: item.id,
              skillId: skill.id,
              userId: user.id,
            }),
          ),
        ),
      );

      const reads = await countDatabaseRows(() =>
        loadAnswerPerItem<{ isCorrect: boolean; itemId: string }>({
          columns: sql`is_correct AS "isCorrect", item_id AS "itemId"`,
          order,
          userId: user.id,
          where: sql`item_id = ANY(${items.map((item) => item.id)}::uuid[])`,
        }),
      );

      expect(reads.rows).toBe(items.length);

      expect(reads.result.toSorted((a, b) => a.itemId.localeCompare(b.itemId))).toStrictEqual(
        items
          .map((item) => ({ isCorrect: order === "first", itemId: item.id }))
          .toSorted((a, b) => a.itemId.localeCompare(b.itemId)),
      );
    },
  );
});
