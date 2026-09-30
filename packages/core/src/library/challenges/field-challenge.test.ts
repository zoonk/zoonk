import { randomUUID } from "node:crypto";
import { generateChallengeCase } from "@zoonk/ai/tasks/v2/challenge/case";
import { writtenChallengeCaseFixture } from "@zoonk/testing/fixtures/challenge-written-case";
import { playableLessonFixture } from "@zoonk/testing/fixtures/playable-lessons";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseStepContent } from "../steps/contract/step-contract";
import { getOrCreateFieldChallenge } from "./field-challenge";

/** The model call is the external boundary; the contract check and the shared row run for real. */
vi.mock("@zoonk/ai/tasks/v2/challenge/case", () => ({ generateChallengeCase: vi.fn() }));

type Written = Awaited<ReturnType<typeof generateChallengeCase>>;

function mockCase(data: Written["data"]) {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the data and provenance are read.
  vi.mocked(generateChallengeCase).mockResolvedValueOnce({
    data,
    provenance: {
      generatedAt: new Date().toISOString(),
      model: "openai/gpt-6-sol",
      promptVersion: "test",
      runId: randomUUID(),
    },
  } as Written);
}

const SKILLS = [{ description: null, name: "Judge whether a gap is chance" }];

async function challengeLesson({
  ownerId = null,
  variant = "work",
}: { ownerId?: string | null; variant?: "whatIf" | "work" } = {}) {
  const { steps } = await playableLessonFixture({
    lesson: {
      ownerId,
      spec: { kind: "challenge", skills: SKILLS, variant },
      visibility: ownerId ? "private" : "public",
    },
    steps: ["challenge"],
  });

  return steps[0]?.id ?? "";
}

describe(getOrCreateFieldChallenge, () => {
  beforeEach(() => {
    vi.mocked(generateChallengeCase).mockReset();
  });

  it("writes the work case in the field once and shares it with everyone in the field", async () => {
    const stepId = await challengeLesson();

    const nursingCase = {
      ...writtenChallengeCaseFixture(),
      title: "Is the ward's infection rate up?",
    };

    mockCase(nursingCase);

    const first = await getOrCreateFieldChallenge({ field: "nursing", stepId });
    const second = await getOrCreateFieldChallenge({ field: "nursing", stepId });

    expect(first).toMatchObject({ created: true, status: "ready" });
    expect(second).toMatchObject({ created: false, status: "ready" });

    expect(generateChallengeCase).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ field: "nursing", skills: SKILLS, variant: "work" }),
    );

    const variant = first.status === "ready" ? first.variant : null;
    expect(variant).toMatchObject({ key: "nursing", kind: "field", stepId });
    expect(parseStepContent("challenge", variant?.content).title).toBe(nursingCase.title);
  });

  it("tries once more with the problems, and keeps the general case when both drafts fail", async () => {
    const stepId = await challengeLesson();
    const broken = { ...writtenChallengeCaseFixture(), startNodeId: "missing" };
    mockCase(broken);
    mockCase(broken);

    const result = await getOrCreateFieldChallenge({ field: "retail", stepId });

    expect(result.status).toBe("failed");
    expect(generateChallengeCase).toHaveBeenCalledTimes(2);

    expect(vi.mocked(generateChallengeCase).mock.calls[1]?.[0].problems).not.toHaveLength(0);
  });

  it("leaves a What if challenge and a private course's challenge as they are", async () => {
    const user = await userFixture();

    const [whatIf, privateCase] = await Promise.all([
      challengeLesson({ variant: "whatIf" }),
      challengeLesson({ ownerId: user.id }),
    ]);

    await expect(
      getOrCreateFieldChallenge({ field: "law", stepId: whatIf }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    await expect(
      getOrCreateFieldChallenge({ field: "law", stepId: privateCase }),
    ).resolves.toStrictEqual({ status: "unsupported" });

    expect(generateChallengeCase).not.toHaveBeenCalled();
  });
});
