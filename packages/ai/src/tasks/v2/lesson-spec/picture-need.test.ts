import { beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateQuestions } from "../../../evaluate/evaluate-questions";
import { type LessonScreen, type LessonSpec } from "./lesson-spec-rules";
import { keepTeachingPictures } from "./picture-need";

vi.mock("server-only", () => ({}));
vi.mock("./picture-need.prompt.md", () => ({ default: "Decide whether the picture teaches." }));
vi.mock("../../../evaluate/evaluate-questions", () => ({ evaluateQuestions: vi.fn() }));

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

function screen(overrides: Partial<LessonScreen>): LessonScreen {
  return {
    activityTemplate: null,
    brief: "Brief",
    kind: "explanation",
    skills: [0],
    visual: null,
    ...overrides,
  };
}

function spec(screens: LessonScreen[]): LessonSpec {
  return {
    canDo: "Name the chambers of the heart",
    description: "The heart's four chambers.",
    estimatedMinutes: 3,
    screens,
    skills: [],
    supportMode: "explanationFirst",
    title: "The chambers of the heart",
  };
}

const TRAY = "A shallow tray of water in the sun.";
const HEART = "The heart from the front with its four chambers labeled.";
const CHART = "A chart of balances";

describe(keepTeachingPictures, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops a picture judged decorative and keeps one that teaches, asking once per picture", async () => {
    vi.mocked(evaluateQuestions)
      .mockResolvedValueOnce(verdict(0.2))
      .mockResolvedValueOnce(verdict(0.9));

    const planned = spec([
      screen({ kind: "hook", skills: [], visual: TRAY }),
      screen({ visual: HEART }),
      screen({ activityTemplate: "chartReader", brief: CHART }),
    ]);

    const kept = await keepTeachingPictures({ spec: planned });

    expect(kept.screens.map((item) => item.visual)).toStrictEqual([null, HEART, null]);
    expect(kept.screens[2]?.activityTemplate).toBe("chartReader");
    expect(evaluateQuestions).toHaveBeenCalledTimes(2);

    expect(vi.mocked(evaluateQuestions).mock.calls[1]?.[0].input).toMatchObject({
      PICTURE: HEART,
      PREVIOUS_PICTURE: TRAY,
    });
  });

  it("keeps a picture whose check can't run", async () => {
    vi.mocked(evaluateQuestions).mockRejectedValueOnce(new Error("Gateway unavailable"));

    const kept = await keepTeachingPictures({ spec: spec([screen({ visual: HEART })]) });

    expect(kept.screens[0]?.visual).toBe(HEART);
  });
});
