import { describe, expect, it } from "vitest";
import { parsePythonError } from "./python-error";

describe(parsePythonError, () => {
  it("keeps the error and the learner's line, not Pyodide's own frames", () => {
    const traceback = [
      "Traceback (most recent call last):",
      '  File "/lib/python3.14/site-packages/_pyodide/_base.py", line 597, in eval_code_async',
      "    await CodeRunner(",
      '  File "main.py", line 3, in <module>',
      "    total += m",
      "NameError: name 'm' is not defined",
      "",
    ].join("\n");

    expect(parsePythonError(traceback)).toStrictEqual({
      line: 3,
      message: "NameError: name 'm' is not defined",
    });
  });

  it("reads syntax errors, which point at the line without a frame", () => {
    const traceback = [
      '  File "main.py", line 2',
      "    for n in range(1, 101)",
      "                          ^",
      "SyntaxError: expected ':'",
    ].join("\n");

    expect(parsePythonError(traceback)).toStrictEqual({
      line: 2,
      message: "SyntaxError: expected ':'",
    });
  });

  it("has no line when the error isn't in the program", () => {
    expect(parsePythonError("RuntimeError: boom")).toStrictEqual({
      line: null,
      message: "RuntimeError: boom",
    });
  });
});
