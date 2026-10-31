import { classifyMistakeCause } from "@zoonk/ai/tasks/mistakes/cause";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { resolveMistakeCause } from "./resolve-mistake-cause";

const CAUSE = {
  correctAnswer: "since",
  language: "en",
  learnerAnswer: "for",
  misconception: "",
  question: "I've lived here ___ 2020.",
  recentAccuracy: "3 of 5 right",
};

function classifiedAs(cause: "gap" | "trap") {
  vi.mocked(classifyMistakeCause).mockResolvedValueOnce({
    data: { cause },
    provenance: {} as never,
    systemPrompt: "",
    usage: {} as never,
    userPrompt: "",
  });
}

describe(resolveMistakeCause, () => {
  it("saves the cause once when the notebook entry gets it", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });

    classifiedAs("trap");
    await resolveMistakeCause({ cause: CAUSE, mistakeId: mistake.id, userId: user.id });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "trap" });
  });

  it("never overwrites a cause set meanwhile", async () => {
    const user = await userFixture();
    const settled = await mistakeFixture({ cause: "time", userId: user.id });

    classifiedAs("gap");

    await expect(
      resolveMistakeCause({ cause: CAUSE, mistakeId: settled.id, userId: user.id }),
    ).resolves.toBeNull();

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: settled.id } }),
    ).resolves.toMatchObject({ cause: "time" });
  });

  it("throws a model failure, so its step retries, and saves nothing", async () => {
    const user = await userFixture();
    const open = await mistakeFixture({ cause: null, userId: user.id });

    vi.mocked(classifyMistakeCause).mockRejectedValueOnce(new Error("model down"));

    await expect(
      resolveMistakeCause({ cause: CAUSE, mistakeId: open.id, userId: user.id }),
    ).rejects.toThrow("model down");

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: open.id } }),
    ).resolves.toMatchObject({ cause: null });
  });
});
