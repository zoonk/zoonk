import { describe, expect, it, vi } from "vitest";

describe("writing row line", () => {
  it("uses the saved draft field independently of availability", async () => {
    vi.doMock("next-intl", () => ({ useExtracted: () => (message: string) => message }));
    vi.doMock("./writing-labels", () => ({ useGradingReturnsLine: () => () => "Back tomorrow" }));

    try {
      const { useWritingLine } = await import("./writing-header");
      const writingLine = useWritingLine();
      const continuing = { writingAvailability: { status: "continue" } } as const;

      expect(writingLine(continuing)).toBeNull();
      expect(writingLine({ ...continuing, hasWritingDraft: false })).toBeNull();
      expect(writingLine({ ...continuing, hasWritingDraft: true })).toBe("Your draft is saved");

      expect(
        writingLine({ hasWritingDraft: true, writingAvailability: { status: "available" } }),
      ).toBe("Your draft is saved");
    } finally {
      vi.doUnmock("./writing-labels");
      vi.doUnmock("next-intl");
    }
  });
});
