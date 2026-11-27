import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { describe, expect, it } from "vitest";
import { writingCalibration } from "./_utils/writing-calibration";

describe("writing calibration", () => {
  it("is measured on the grader model and prompt that grade today", () => {
    expect(writingCalibration?.grader ?? getWritingGrader()).toStrictEqual(getWritingGrader());
  });
});
