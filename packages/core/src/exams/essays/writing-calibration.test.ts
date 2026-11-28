import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { getWritingKeyWriter } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { describe, expect, it } from "vitest";
import { writingCalibration, writingCalibrationSchema } from "./_utils/writing-calibration";
import saved from "./_utils/writing-calibration-data.json";

describe("writing calibration", () => {
  it("reads the generated calibration with the model and prompt revisions used today", () => {
    const serialized = JSON.stringify(saved);
    const calibration = writingCalibrationSchema.parse(JSON.parse(serialized));

    expect(calibration).toStrictEqual(writingCalibration);
    expect(calibration.grader).toStrictEqual(getWritingGrader());
    expect(calibration.writer).toStrictEqual(getWritingKeyWriter());
  });
});
