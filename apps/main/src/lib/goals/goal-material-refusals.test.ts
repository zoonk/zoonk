import { afterEach, describe, expect, it, vi } from "vitest";
import { askMaterialQuestion } from "./goal-material-questions";
import { attachGoalText } from "./goal-uploads";

const refusal = vi.hoisted(() => ({
  body: {
    error: {
      code: "USAGE_LIMIT_REACHED",
      details: {
        limit: { availableAt: "2026-12-04T09:00:00.000Z", period: "rolling30Days", tier: "free" },
      },
      message: "This plan's limit is reached",
    },
  },
}));

vi.mock(import("../api/browser-api"), () => ({
  postFromBrowser: async () => Response.json(refusal.body, { status: 402 }),
}));

describe("a refused upload or material question", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["an upload", () => attachGoalText({ language: "en", text: "My notes" })],
    [
      "a question about the material",
      () => askMaterialQuestion({ language: "en", question: "Why?", sourceIds: ["s1"] }),
    ],
  ])("%s keeps when more comes back, stamped with when it arrived", async (_name, send) => {
    vi.useFakeTimers({ now: new Date("2026-12-02T09:00:30.000Z"), toFake: ["Date"] });

    await expect(send()).resolves.toStrictEqual({
      availableAt: "2026-12-04T09:00:00.000Z",
      period: "rolling30Days",
      receivedAt: Date.parse("2026-12-02T09:00:30.000Z"),
      status: "limitReached",
      tier: "free",
    });
  });
});
