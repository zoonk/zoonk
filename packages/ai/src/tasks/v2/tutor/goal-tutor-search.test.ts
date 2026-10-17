import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { shouldSearchFirst } from "./goal-tutor-search";

vi.mock("server-only", () => ({}));
vi.mock("./goal-tutor-search.prompt.md", () => ({ default: "Decide whether to search." }));

/** The classifier is a model call: these tests stand in for its verdict, slowness or failure. */
vi.mock("../../../evaluate/evaluate-questions", () => ({ evaluateQuestions: vi.fn() }));

const SUCUMBENCIA = {
  earlierQuestion: null,
  goal: "OAB 1ª fase",
  question: "o contrato pode dizer que a sucumbência vai pra empresa?",
};

function verdict(probability: number) {
  return {
    answers: { needsCurrentSource: { probability } },
    latencyMs: 400,
    model: "typesafe-ai/jev",
    requestedModel: "typesafe-ai/jev",
    state: "",
    usage: { inputTokens: 0, outputTokens: 0 },
  } as unknown as Awaited<ReturnType<typeof evaluateQuestions>>;
}

describe(shouldSearchFirst, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("searches first when the answer rests on facts that change", async () => {
    vi.mocked(evaluateQuestions).mockResolvedValueOnce(verdict(0.93));
    await expect(shouldSearchFirst(SUCUMBENCIA)).resolves.toBe(true);
  });

  it("leaves stable questions to the buddy's own judgment", async () => {
    vi.mocked(evaluateQuestions).mockResolvedValueOnce(verdict(0.08));
    await expect(shouldSearchFirst(SUCUMBENCIA)).resolves.toBe(false);
  });

  it("never holds the answer back when the classifier fails", async () => {
    vi.mocked(evaluateQuestions).mockRejectedValueOnce(new Error("Gateway unavailable"));
    await expect(shouldSearchFirst(SUCUMBENCIA)).resolves.toBe(false);
  });

  it("never holds the answer back when the classifier is slow", async () => {
    vi.useFakeTimers();

    vi.mocked(evaluateQuestions).mockReturnValueOnce(
      new Promise(() => {
        // Never answers.
      }),
    );

    const decision = shouldSearchFirst(SUCUMBENCIA);
    await vi.advanceTimersByTimeAsync(3000);

    await expect(decision).resolves.toBe(false);
  });
});
