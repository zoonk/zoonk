import { resolveCoursePrompt as resolveCoreCoursePrompt } from "@zoonk/core/courses/resolve-prompt";
import { AI_ORG_SLUG } from "@zoonk/utils/org";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveCoursePrompt } from "./course-prompt";

vi.mock("@zoonk/core/courses/resolve-prompt", () => ({ resolveCoursePrompt: vi.fn() }));

describe(resolveCoursePrompt, () => {
  beforeEach(() => {
    vi.mocked(resolveCoreCoursePrompt).mockResolvedValue({ kind: "unsafe" });
  });

  it("maps a reusable course resource to the public AI course route", async () => {
    vi.mocked(resolveCoreCoursePrompt).mockResolvedValue({
      course: { id: "course-id", slug: "biology" },
      kind: "course",
    });

    await expect(resolveCoursePrompt({ language: "en", prompt: "biology" })).resolves.toStrictEqual(
      { href: `/b/${AI_ORG_SLUG}/c/biology`, kind: "course" },
    );
  });

  it("maps language and exam outcomes to their web start routes", async () => {
    vi.mocked(resolveCoreCoursePrompt).mockResolvedValueOnce({ kind: "language" });
    vi.mocked(resolveCoreCoursePrompt).mockResolvedValueOnce({ kind: "exam" });

    const [language, exam] = await Promise.all([
      resolveCoursePrompt({ language: "en", prompt: "learn Japanese" }),
      resolveCoursePrompt({ language: "en", prompt: "SAT prep" }),
    ]);

    expect(language).toStrictEqual({ href: "/start/speak", kind: "redirect" });
    expect(exam).toStrictEqual({ href: "/start/exam", kind: "redirect" });
  });

  it("passes non-navigation outcomes through unchanged", async () => {
    await expect(resolveCoursePrompt({ language: "en", prompt: "unsafe" })).resolves.toStrictEqual({
      kind: "unsafe",
    });
  });
});
