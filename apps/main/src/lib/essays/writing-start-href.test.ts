import { describe, expect, it } from "vitest";
import { getWritingHref, readWritingStart } from "./writing-start-href";

const BLOCK_ID = "01a1fb48-f3e6-767d-ac7e-ff85a461f606";

function readHref(href: string) {
  return readWritingStart(Object.fromEntries(new URL(href, "https://zoonk.test").searchParams));
}

describe(getWritingHref, () => {
  it("a refused start carries the task left for tomorrow to the page that lists it", () => {
    const href = getWritingHref({
      answer: {
        returnsOn: "2026-11-21",
        status: "limitReached",
        task: {
          description: "The 60-line question",
          lines: 60,
          minutes: 140,
          points: 70,
          taskKey: "long",
          unit: "answer",
        },
      },
      blockId: BLOCK_ID,
    });

    expect(readHref(href)).toStrictEqual({
      status: "limitReached",
      task: { minutes: 140, title: "The 60-line question" },
    });
  });

  it("a refusal without its task lists none", () => {
    const href = getWritingHref({
      answer: { returnsOn: "2026-11-21", status: "limitReached" },
      blockId: BLOCK_ID,
    });

    expect(readHref(href)).toStrictEqual({ status: "limitReached", task: null });
  });

  it("a question being written and a failed start keep their own states", () => {
    const writing = getWritingHref({
      answer: { generationId: "wrun_1", status: "writing" },
      blockId: BLOCK_ID,
    });

    const failed = getWritingHref({ answer: { status: "failed" }, blockId: BLOCK_ID });

    expect(readHref(writing)).toStrictEqual({ generationId: "wrun_1" });
    expect(readHref(failed)).toStrictEqual({ status: "failed" });

    expect(
      getWritingHref({ answer: { admissionId: "a", status: "ready" }, blockId: BLOCK_ID }),
    ).toBe(`/essay/${BLOCK_ID}`);
  });
});
