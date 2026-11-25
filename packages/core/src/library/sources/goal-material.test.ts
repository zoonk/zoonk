import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { goalSourceFixture, sourceFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseRows } from "@zoonk/testing/statement-counter";
import { describe, expect, it } from "vitest";
import { loadGoalMaterial } from "./goal-material";

describe(loadGoalMaterial, () => {
  it("fetches only the five readable transcripts the goal uses", async () => {
    const user = await userFixture();
    const goal = await goalFixture({ userId: user.id });
    const texts = ["[illegible]\f", "ação", "分数", "٢", "Cell division", "Interphase", "Mitosis"];

    await Promise.all(
      texts.map(async (text, index) => {
        const source = await sourceFixture({ createdAt: new Date(index), extractedText: text });
        await goalSourceFixture({ goalId: goal.id, sourceId: source.id });
      }),
    );

    const { result, rows } = await countDatabaseRows(
      () => loadGoalMaterial(goal.id),
      "extracted_text",
    );

    expect(result.map(({ text }) => text)).toStrictEqual(texts.slice(1, 6));
    expect(rows).toBe(5);
  });
});
