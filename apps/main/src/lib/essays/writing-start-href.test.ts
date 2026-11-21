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
      task: { minutes: 140, title: "The 60-line question", unit: "answer", writingTask: null },
    });
  });

  it("a refused drill keeps its unit, so the page names it as a drill and not as its task", () => {
    const href = getWritingHref({
      answer: {
        returnsOn: "2026-11-21",
        status: "limitReached",
        task: {
          description: "The 30-line question",
          lines: 30,
          minutes: 8,
          points: 30,
          taskKey: "short",
          unit: "drill",
        },
      },
      blockId: BLOCK_ID,
    });

    expect(readHref(href)).toStrictEqual({
      status: "limitReached",
      task: { minutes: 8, title: "The 30-line question", unit: "drill", writingTask: null },
    });
  });

  it("a refused task keeps its place in the written test, so the page names it the same way", () => {
    const task = {
      description: "Questão discursiva 2, de até 30 linhas",
      distinctLines: false,
      lines: 30,
      minutes: 70,
      number: 2,
      points: 30,
      taskKey: "second",
      total: 2,
      unit: "answer" as const,
    };

    // The address carries what names the task: its place, not its points.
    const writingTask = { distinctLines: false, lines: 30, number: 2, total: 2 };

    const href = getWritingHref({
      answer: { returnsOn: "2026-11-21", status: "limitReached", task },
      blockId: BLOCK_ID,
    });

    expect(readHref(href)).toMatchObject({ task: { writingTask } });
  });

  it("a refusal without its task lists none", () => {
    const href = getWritingHref({
      answer: { returnsOn: "2026-11-21", status: "limitReached" },
      blockId: BLOCK_ID,
    });

    expect(readHref(href)).toStrictEqual({ status: "limitReached", task: null });
  });

  it("a question being written, a failed start and a removed task keep their own states", () => {
    const writing = getWritingHref({
      answer: { generationId: "wrun_1", status: "writing" },
      blockId: BLOCK_ID,
    });

    const drill = getWritingHref({
      answer: { generationId: "wrun_2", status: "writing", unit: "drill" },
      blockId: BLOCK_ID,
    });

    const failed = getWritingHref({ answer: { status: "failed" }, blockId: BLOCK_ID });
    const removed = getWritingHref({ answer: { status: "taskRemoved" }, blockId: BLOCK_ID });

    expect(readHref(writing)).toStrictEqual({ generationId: "wrun_1", unit: "answer" });
    expect(readHref(drill)).toStrictEqual({ generationId: "wrun_2", unit: "drill" });
    expect(readHref(failed)).toStrictEqual({ status: "failed" });
    expect(readHref(removed)).toStrictEqual({ status: "taskRemoved" });

    expect(
      getWritingHref({ answer: { admissionId: "a", status: "ready" }, blockId: BLOCK_ID }),
    ).toBe(`/essay/${BLOCK_ID}`);
  });
});
