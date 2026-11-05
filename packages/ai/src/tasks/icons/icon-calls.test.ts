import { describe, expect, it, vi } from "vitest";
import { runUnderPromptTrainingRule } from "../../data-protection";
import { matchLessonIcons } from "./icon-match";
import { generateLessonIconImage } from "./lesson-icon-image";

vi.mock("server-only", () => ({}));
vi.mock("./icon-match.prompt.md", () => ({ default: "Reuse or draw." }));
vi.mock("./lesson-icon-style.prompt.md", () => ({ default: "Draw {{SUBJECT}}." }));

vi.mock("../../data-protection", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runUnderPromptTrainingRule: vi.fn(() => Promise.reject(new Error("stopped before the call"))),
}));

const need = { description: "A wooden rubber stamp", name: "rubber stamp", searchWords: [] };
const shared = { contentScope: "shared" as const };

describe("icon library calls", () => {
  it("keep the no-training filter for a shared lesson, since library icons may come from private lessons", async () => {
    await expect(
      matchLessonIcons({
        analytics: shared,
        needs: [{ candidates: [{ ...need, id: "icon", tags: [] }], need, usedFor: "a screen" }],
      }),
    ).rejects.toThrow("stopped before the call");

    await expect(generateLessonIconImage({ analytics: shared, need })).rejects.toThrow(
      "stopped before the call",
    );

    expect(
      vi.mocked(runUnderPromptTrainingRule).mock.calls.map(([input]) => input.libraryInput),
    ).toStrictEqual([undefined, undefined]);
  });
});
