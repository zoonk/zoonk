import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it } from "vitest";
import { HookConflictError } from "workflow/errors";
import { getStartMock } from "../_test-utils/start-mock";
import { followUpsWorkflow } from "./follow-ups-workflow";

const CAUSE = {
  correctAnswer: "since",
  language: "en",
  learnerAnswer: "for",
  misconception: "",
  question: "I've lived here ___ 2020.",
  recentAccuracy: "3 of 5 right",
};

describe(followUpsWorkflow, () => {
  it("keeps a row whose start named a run that was never created", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });

    await prisma.followUp.create({
      data: {
        input: { cause: CAUSE, mistakeId: mistake.id },
        key: mistake.id,
        kind: "classifyMistakeCause",
        userId: user.id,
      },
    });

    getStartMock().mockRejectedValue(new HookConflictError("background-task", "admitted"));

    const failure = await followUpsWorkflow({ userId: user.id }).catch((error: unknown) => error);

    await expect(prisma.followUp.count({ where: { userId: user.id } })).resolves.toBe(1);
    expect(failure).toBeInstanceOf(Error);
  });
});
