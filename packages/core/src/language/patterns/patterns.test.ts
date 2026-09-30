import { findMistakePattern } from "@zoonk/ai/tasks/v2/language/mistake-pattern";
import { prisma } from "@zoonk/db";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { libraryStepFixture } from "@zoonk/testing/fixtures/library-steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { after } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { dismissMistakePattern } from "./dismiss-mistake-pattern";
import { scheduleMistakePatternCheck } from "./find-mistake-pattern";
import { getMistakePattern } from "./get-mistake-pattern";
import { practiceMistakePattern } from "./practice-mistake-pattern";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));

// Finding a pattern is a paid model call.
vi.mock("@zoonk/ai/tasks/v2/language/mistake-pattern", () => ({ findMistakePattern: vi.fn() }));

const DRILL = [
  {
    answer: "since",
    feedback: "Quando começou.",
    options: ["since", "for", "from"],
    sentence: "I've lived here ___ 2020.",
  },
  {
    answer: "for",
    feedback: "Quanto tempo.",
    options: ["since", "for", "from"],
    sentence: "I've lived here ___ six years.",
  },
];

const PATTERN_OUTPUT = {
  contrast: [{ example: "since 2020", label: "since + quando começou" }],
  drill: DRILL,
  kind: "pattern" as const,
  mistakeNumbers: [1, 3],
  rule: "Começou no passado e continua? Use have + particípio.",
  title: "since e for",
};

async function runScheduledCheck() {
  const callback = vi.mocked(after).mock.calls.at(-1)?.[0];

  if (typeof callback !== "function") {
    throw new TypeError("No check was scheduled");
  }

  await callback();
}

async function languageMistakes(count: number) {
  const setup = await languageGoalFixture();
  const [lesson] = setup.lessons;

  if (!lesson) {
    throw new Error("No lesson");
  }

  const step = await libraryStepFixture({ kind: "typedAnswer", lessonId: lesson.id });

  for (let index = 0; index < count; index += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Mistakes are created in order, so the newest comes first.
    await mistakeFixture({
      snapshot: {
        answer: `I live here since 20${20 + index}`,
        correctAnswer: `I've lived here since 20${20 + index}`,
        format: "typedAnswer",
        question: "Moro aqui desde…",
      },
      stepId: step.id,
      userId: setup.user.id,
    });
  }

  return setup;
}

describe("mistake patterns", () => {
  it("checks every third new mistake and saves the pattern it finds", async () => {
    const { goal, user } = await languageMistakes(3);

    vi.mocked(findMistakePattern).mockResolvedValue({
      data: PATTERN_OUTPUT,
      provenance: {
        generatedAt: new Date().toISOString(),
        latencyMs: 1,
        model: "m",
        promptVersion: "v",
        provider: "p",
        requestedModel: "m",
        runId: "r",
        usage: {},
      },
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });

    scheduleMistakePatternCheck({ language: "en", userId: user.id });
    await runScheduledCheck();

    const saved = await prisma.mistakePattern.findFirstOrThrow({ where: { userId: user.id } });

    expect(saved).toMatchObject({
      goalId: goal.id,
      kind: "pattern",
      language: "en",
      title: "since e for",
    });

    expect(saved.mistakeIds).toHaveLength(2);

    expect(findMistakePattern).toHaveBeenCalledWith(
      expect.objectContaining({ learnerLanguage: "pt" }),
    );
  });

  it("waits for a few new mistakes before checking", async () => {
    const { user } = await languageMistakes(2);

    scheduleMistakePatternCheck({ language: "en", userId: user.id });
    await runScheduledCheck();

    expect(findMistakePattern).not.toHaveBeenCalled();
  });

  it("drills a pattern once for full Brain Power and takes it off Today", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: {
          contrast: PATTERN_OUTPUT.contrast,
          drill: DRILL,
          examples: [],
          rule: PATTERN_OUTPUT.rule,
        },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "since e for",
        userId: user.id,
      },
    });

    await expect(getMistakePattern(pattern.id)).resolves.toMatchObject({
      pattern: { drill: DRILL, practiced: false, title: "since e for" },
      status: "ready",
    });

    const invalid = await practiceMistakePattern({
      input: { answers: ["since"], timeZone: "America/Sao_Paulo" },
      patternId: pattern.id,
    });

    expect(invalid).toStrictEqual({ status: "invalid" });

    const result = await practiceMistakePattern({
      input: { answers: ["since", "since"], timeZone: "America/Sao_Paulo" },
      patternId: pattern.id,
    });

    expect(result).toMatchObject({ result: { correct: 1, total: 2 }, status: "ready" });
    expect(result.status === "ready" && result.result.brainPower).toBeGreaterThan(0);

    await expect(getMistakePattern(pattern.id)).resolves.toMatchObject({
      pattern: { practiced: true },
    });
  });

  it("takes a typos note off Today once dismissed", async () => {
    const { goal, user } = await languageGoalFixture();
    mockSession(user.id);

    const note = await prisma.mistakePattern.create({
      data: {
        content: { contrast: [], drill: [], examples: [], rule: "Só erros de digitação." },
        goalId: goal.id,
        kind: "typos",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "Só erros de digitação",
        userId: user.id,
      },
    });

    await expect(dismissMistakePattern(note.id)).resolves.toStrictEqual({ status: "dismissed" });
    await expect(dismissMistakePattern(note.id)).resolves.toStrictEqual({ status: "dismissed" });

    const saved = await prisma.mistakePattern.findUniqueOrThrow({ where: { id: note.id } });
    expect(saved.dismissedAt).not.toBeNull();

    const stranger = await userFixture();
    mockSession(stranger.id);
    await expect(dismissMistakePattern(note.id)).resolves.toStrictEqual({ status: "notFound" });
  });

  it("keeps another learner's pattern hidden", async () => {
    const { goal, user } = await languageGoalFixture();

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: { contrast: [], drill: [], examples: [], rule: "" },
        goalId: goal.id,
        kind: "typos",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "Só erros de digitação",
        userId: user.id,
      },
    });

    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(getMistakePattern(pattern.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});
