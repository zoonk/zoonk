import { describe, expect, it } from "vitest";
import { MAX_PROGRAM_OUTPUT_LENGTH } from "./program-limits";
import { toProgramRun } from "./program-runs";

const FLOOD = "x".repeat(MAX_PROGRAM_OUTPUT_LENGTH * 2);

describe(toProgramRun, () => {
  it("caps an error message at the output limit, as it caps output", () => {
    const javascript = toProgramRun("javascript", { error: FLOOD, status: "error", stdout: FLOOD });

    const python = toProgramRun("python", {
      error: `Traceback (most recent call last):\n  File "main.py", line 2, in <module>\nValueError: ${FLOOD}`,
      status: "error",
    });

    expect(javascript.output).toHaveLength(MAX_PROGRAM_OUTPUT_LENGTH);
    expect(javascript.error?.message).toHaveLength(MAX_PROGRAM_OUTPUT_LENGTH);
    expect(python.error?.message).toHaveLength(MAX_PROGRAM_OUTPUT_LENGTH);
    expect(python.error?.line).toBe(2);
  });
});
