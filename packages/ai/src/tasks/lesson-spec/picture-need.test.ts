import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateQuestions } from "../../evaluate/evaluate-questions";
import { judgePicture } from "./picture-need";

vi.mock("server-only", () => ({}));
vi.mock("./picture-need.prompt.md", () => ({ default: "Decide whether the picture teaches." }));
vi.mock("../../evaluate/evaluate-questions", () => ({ evaluateQuestions: vi.fn() }));

function verdict(probability: number) {
  return {
    answers: { teaches: { probability } },
    latencyMs: 400,
    model: "typesafe-ai/jev",
    requestedModel: "typesafe-ai/jev",
    state: "",
    usage: { inputTokens: 0, outputTokens: 0 },
  } as unknown as Awaited<ReturnType<typeof evaluateQuestions>>;
}

const HEART = "The heart from the front with its four chambers labeled.";
const TRAY = "A shallow tray of water in the sun.";

const input = {
  lesson: "The chambers of the heart",
  level: "beginner" as const,
  picture: HEART,
  previousPicture: TRAY,
  screen: { brief: "The four chambers and where blood enters.", kind: "explanation" },
};

describe(judgePicture, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a picture above the threshold and drops one below it, asking with the level", async () => {
    vi.mocked(evaluateQuestions)
      .mockResolvedValueOnce(verdict(0.9))
      .mockResolvedValueOnce(verdict(0.2));

    await expect(judgePicture(input)).resolves.toBe(true);
    await expect(judgePicture(input)).resolves.toBe(false);

    expect(vi.mocked(evaluateQuestions).mock.calls[0]?.[0].input).toStrictEqual({
      LESSON: "The chambers of the heart",
      LEVEL: "beginner",
      PICTURE: HEART,
      PREVIOUS_PICTURE: TRAY,
      SCREEN: "explanation: The four chambers and where blood enters.",
    });
  });

  it("throws when the judge can't answer, so its workflow step retries", async () => {
    vi.mocked(evaluateQuestions).mockRejectedValueOnce(new Error("Gateway unavailable"));

    await expect(judgePicture(input)).rejects.toThrow("Gateway unavailable");
  });
});
