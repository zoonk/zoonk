import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { updateLearningProfile } from "../profile/update-learning-profile";
import { getGoal } from "./get-goal";
import { updateGoal } from "./update-goal";

describe("country views", () => {
  it("shows the picked country and rebuild status while preserving its old plan", async () => {
    const user = await userFixture();

    const goal = await goalFixture({
      details: { countryDependent: true },
      language: "pt",
      userId: user.id,
    });

    mockSession(user.id);
    await updateGoal({ goalId: goal.id, input: { contentCountry: "PT" } });

    await expect(getGoal(goal.id)).resolves.toMatchObject({
      goal: {
        contentCountry: {
          code: "PT",
          editable: true,
          kind: "content",
          lessonVariety: { language: "pt", region: "BR" },
          name: "Portugal",
          rebuild: "preparing",
          source: "picked",
        },
        countryDependent: true,
        languageCountry: { code: "BR", name: "Brasil" },
      },
    });

    await prisma.followUp.updateMany({
      data: { failedAt: new Date() },
      where: { key: goal.id, userId: user.id },
    });

    await expect(getGoal(goal.id)).resolves.toMatchObject({
      goal: { contentCountry: { rebuild: "failed" } },
    });
  });

  it("shows examples only on known general goals and leaves older goals alone", async () => {
    const user = await userFixture();
    await learningProfileFixture({ homeCountry: "PT", userId: user.id });

    const general = await goalFixture({
      details: { countryDependent: false },
      language: "pt",
      userId: user.id,
    });

    const legacy = await goalFixture({ language: "pt", userId: user.id });
    mockSession(user.id);

    await expect(getGoal(general.id)).resolves.toMatchObject({
      goal: { contentCountry: null, examplesCountry: { code: "BR", name: "Brasil" } },
    });

    await expect(getGoal(legacy.id)).resolves.toMatchObject({
      goal: { contentCountry: null, examplesCountry: null },
    });

    await updateLearningProfile({ homeCountry: "BR" });
    await expect(getGoal(general.id)).resolves.toMatchObject({ goal: { examplesCountry: null } });
  });

  it.each([
    { country: "AR", row: expect.objectContaining({ code: "AR", editable: false, kind: "exam" }) },
    { country: "BR", row: null },
    { country: "ZZ", row: null },
  ])(
    "names foreign exam countries and hides own or international rows: $country",
    async ({ country, row }) => {
      const user = await userFixture();
      mockSession(user.id);
      const exam = await examBlueprintFixture({ country });

      const goal = await goalFixture({
        examBlueprintId: exam.id,
        kind: "exam",
        language: "pt",
        userId: user.id,
      });

      const result = await getGoal(goal.id);
      expect(result).toMatchObject({ status: "ready" });

      if (result.status !== "ready") {
        throw new Error("Goal unavailable");
      }

      expect(result.goal.contentCountry).toStrictEqual(row);
    },
  );
});
