import { getWritingGrader } from "@zoonk/ai/tasks/grading/grade-essay";
import { getWritingKeyWriter } from "@zoonk/ai/tasks/items/write-writing-prompt";
import { describe, expect, it } from "vitest";
import { writingCalibration } from "./_utils/writing-calibration";

const mechanisms = { enem: ["enem"], keyed: ["points", "oab"] } as const;

describe("writing calibration", () => {
  it.each(["keyed", "enem"] as const)(
    "keeps %s calibration tied to the measured tasks",
    (mechanism) => {
      const calibration = writingCalibration[mechanism];

      if (!calibration) {
        return;
      }

      const writer = getWritingKeyWriter();

      expect(calibration.keyWriter).toStrictEqual({
        model: writer.model,
        promptRevision: writer.promptVersion,
      });

      for (const kind of mechanisms[mechanism]) {
        const grader = getWritingGrader(kind);
        expect(calibration.grader.model).toBe(grader.model);
        expect(calibration.grader.promptRevision).toHaveProperty(kind, grader.promptVersion);
      }
    },
  );
});
