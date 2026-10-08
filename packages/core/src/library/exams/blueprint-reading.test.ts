import { EXAM_BLUEPRINT_PROMPT_VERSION } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint-version";
import { describe, expect, it } from "vitest";
import { isNoticeReadAgain } from "./blueprint-reading";

const NOW = new Date("2026-10-06T12:00:00.000Z");

describe(isNoticeReadAgain, () => {
  it("reads an edition still ahead again when older instructions read it", () => {
    const ahead = new Date("2027-01-17T00:00:00.000Z");

    expect(
      isNoticeReadAgain({ blueprint: { examDate: ahead, promptVersion: "older" }, now: NOW }),
    ).toBe(true);

    expect(
      isNoticeReadAgain({
        blueprint: { examDate: ahead, promptVersion: EXAM_BLUEPRINT_PROMPT_VERSION },
        now: NOW,
      }),
    ).toBe(false);
  });

  it("leaves a passed edition to the search for the next notice", () => {
    const passed = new Date("2026-08-02T00:00:00.000Z");

    expect(
      isNoticeReadAgain({ blueprint: { examDate: passed, promptVersion: "older" }, now: NOW }),
    ).toBe(false);
  });
});
