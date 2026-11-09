import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { saveAnswerInputs } from "./_utils/save-onboarding-answer";

describe("language-only reason answers", () => {
  it.each(["exam", "learn", "explain"] as const)(
    "refuses a forged reason on a %s goal and preserves its target",
    async (kind) => {
      const user = await userFixture();
      mockSession(user.id);

      const goal = await goalFixture({
        details: {
          answered: ["target"],
          examName: "IELTS",
          examTarget: "score",
          targetScore: "7.5",
        },
        kind,
        userId: user.id,
      });

      const saved = await saveAnswerInputs({
        goal,
        input: { question: "reason", reason: "travel" },
      });

      const result = await prisma.goal.findUniqueOrThrow({ where: { id: goal.id } });
      expect(result.details).toStrictEqual(goal.details);
      expect(saved.status).toBe("invalid");
    },
  );
});
