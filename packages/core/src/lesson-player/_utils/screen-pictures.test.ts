import { activityContentFixtures } from "@zoonk/testing/fixtures/activity-contents";
import { numberedCheckContent } from "@zoonk/testing/fixtures/playable-step-contents";
import { afterEach, describe, expect, it, vi } from "vitest";
import { tallyLessonRun } from "../lesson-run";
import { getScreenPictures } from "./screen-pictures";

const WRITTEN_AT = new Date("2026-10-13T00:00:00.000Z");
const PICTURE_WAIT_MS = 300_000;
const row = { generatedAt: WRITTEN_AT, mediaAsset: null };

describe("picture omission and completion share a generation deadline", () => {
  afterEach(() => vi.useRealTimers());

  it("includes a new numbered question after the old client timeout, with its original start", () => {
    vi.useFakeTimers();
    vi.setSystemTime(WRITTEN_AT.getTime() + 152_000);
    const pictures = getScreenPictures({ content: numberedCheckContent, kind: "check", row });
    expect(pictures.content).toStrictEqual(numberedCheckContent);
    expect(pictures.imagePending).toBe(true);
    expect(pictures.pictureWaitStartedAt).toBe(WRITTEN_AT.getTime());

    expect(
      tallyLessonRun({ attempts: [], steps: [{ id: "numbered", kind: "check" }] }).isComplete,
    ).toBe(false);
  });

  it("omits the question exactly at five minutes, allowing a run without that answer to finish", () => {
    vi.useFakeTimers();
    vi.setSystemTime(WRITTEN_AT.getTime() + PICTURE_WAIT_MS);
    const pictures = getScreenPictures({ content: numberedCheckContent, kind: "check", row });
    expect(pictures.imagePending).toBe(false);
    expect(pictures.content).toBeNull();
    const steps = pictures.content ? [{ id: "numbered", kind: "check" as const }] : [];
    expect(tallyLessonRun({ attempts: [], steps }).isComplete).toBe(true);
  });

  it("omits a lost diagram activity but keeps an explanation's words without its explorer", () => {
    vi.useFakeTimers();
    vi.setSystemTime(WRITTEN_AT.getTime() + PICTURE_WAIT_MS);
    const diagram = activityContentFixtures.labeledDiagram;
    expect(getScreenPictures({ content: diagram, kind: "activity", row }).content).toBeNull();

    const explanation = {
      explore: { fields: diagram.fields, template: "labeledDiagram" },
      text: "The heart has four chambers.",
    };

    expect(
      getScreenPictures({ content: explanation, kind: "explanation", row }).content,
    ).toStrictEqual({ ...explanation, explore: undefined });
  });
});
