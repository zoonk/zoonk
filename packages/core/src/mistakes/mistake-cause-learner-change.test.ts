import { classifyMistakeCause } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { scheduleMistakeCause } from "./resolve-mistake-cause";

const INPUT = {
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

async function classify(request: { mistakeId: string; userId: string }) {
  const flush = runDeferredWork();
  scheduleMistakeCause({ input: INPUT, ...request });
  await flush();
}

describe("mistake cause writes", () => {
  it("saves the cause once when the notebook entry gets it", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });

    classifiedAs("trap");
    await classify({ mistakeId: mistake.id, userId: user.id });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "trap" });
  });

  it("changes nothing when the cause was set meanwhile or the model fails", async () => {
    const user = await userFixture();
    const settled = await mistakeFixture({ cause: "time", userId: user.id });
    const open = await mistakeFixture({ cause: null, userId: user.id });

    classifiedAs("gap");
    await classify({ mistakeId: settled.id, userId: user.id });

    vi.mocked(classifyMistakeCause).mockRejectedValueOnce(new Error("model down"));
    await classify({ mistakeId: open.id, userId: user.id });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: settled.id } }),
    ).resolves.toMatchObject({ cause: "time" });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: open.id } }),
    ).resolves.toMatchObject({ cause: null });
  });
});
