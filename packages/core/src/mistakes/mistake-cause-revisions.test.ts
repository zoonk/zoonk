import { classifyMistakeCause } from "@zoonk/ai/tasks/v2/mistakes/cause";
import { prisma } from "@zoonk/db";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { runDeferredWork } from "../_test-utils/deferred-work";
import { readLearnerRevision } from "../_test-utils/learner-revision";
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

describe("mistake cause revisions", () => {
  it("raises the revision once when the notebook entry gets its cause", async () => {
    const user = await userFixture();
    const mistake = await mistakeFixture({ cause: null, userId: user.id });

    classifiedAs("trap");
    await classify({ mistakeId: mistake.id, userId: user.id });

    await expect(
      prisma.mistake.findUniqueOrThrow({ where: { id: mistake.id } }),
    ).resolves.toMatchObject({ cause: "trap" });

    await expect(readLearnerRevision(user.id)).resolves.toBe(1n);
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
      prisma.mistake.findMany({ orderBy: { createdAt: "asc" }, where: { userId: user.id } }),
    ).resolves.toMatchObject([{ cause: "time" }, { cause: null }]);

    await expect(readLearnerRevision(user.id)).resolves.toBe(0n);
  });
});
