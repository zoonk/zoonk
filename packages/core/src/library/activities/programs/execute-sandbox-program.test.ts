import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { scriptedSandbox } from "./_test-utils/scripted-sandbox";
import { executeSandboxProgram, sandboxRunError } from "./execute-sandbox-program";
import { MAX_PROGRAM_OUTPUT_LENGTH } from "./program-limits";

describe("sandbox program commands", () => {
  it("copies source as bytes and passes only fixed toolchain arguments to the wrapper", async () => {
    const sandbox = scriptedSandbox({ run: { stdout: "hello\n" } });
    const runId = randomUUID();
    const onPhase = vi.fn();
    const code = '#include <iostream>\nint main() { std::cout << "hello"; }';

    await expect(
      executeSandboxProgram({ code, language: "cpp", onPhase, runId, sandbox }),
    ).resolves.toMatchObject({ errorOutput: "", output: "hello\n", runId, stop: "done" });

    expect(sandbox.write).toHaveBeenCalledWith([
      { content: code, path: `/vercel/sandbox/runs/${runId}/main.cpp` },
    ]);

    expect(sandbox.run.mock.calls.map(([command]) => command.args)).toStrictEqual([
      ["prepare", runId, "main.cpp"],
      ["compile", runId, "10", "40001", "g++", "-std=c++23", "-o", "main", "main.cpp"],
      ["run", runId, "3", "40001", "./main"],
      ["clean", runId],
    ]);

    expect(onPhase.mock.calls).toStrictEqual([["compiling"], ["running"]]);
  });

  it("keeps compilation diagnostics separate from graded stdout", async () => {
    const sandbox = scriptedSandbox({
      compile: { exitCode: 1, stdout: "Main.java:2: error: missing" },
    });

    await expect(
      executeSandboxProgram({ code: "broken", language: "java", runId: randomUUID(), sandbox }),
    ).resolves.toMatchObject({ error: { line: 2, message: "missing" }, output: "", stop: "error" });

    expect(sandbox.run.mock.calls.map(([command]) => command.args[0])).toStrictEqual([
      "prepare",
      "compile",
      "clean",
    ]);
  });

  it("keeps output printed before a timeout within the cap", async () => {
    const sandbox = scriptedSandbox({
      run: { exitCode: 137, stderr: "warning", stdout: "before\n" },
    });

    await expect(
      executeSandboxProgram({ code: "loop", language: "ruby", runId: randomUUID(), sandbox }),
    ).resolves.toMatchObject({ errorOutput: "warning", output: "before\n", stop: "timeout" });
  });

  it("caps the combined output and detects a flood across both streams", async () => {
    const sandbox = scriptedSandbox({
      compile: { stderr: "warning" },
      run: { stderr: "extra", stdout: "é".repeat(MAX_PROGRAM_OUTPUT_LENGTH) },
    });

    await expect(
      executeSandboxProgram({ code: "many prints", language: "go", runId: randomUUID(), sandbox }),
    ).resolves.toMatchObject({
      errorOutput: "",
      output: "é".repeat(MAX_PROGRAM_OUTPUT_LENGTH),
      stop: "tooMuchOutput",
    });
  });

  it("keeps capped output valid Unicode for database replay", async () => {
    const prefix = "a".repeat(MAX_PROGRAM_OUTPUT_LENGTH - 1);
    const sandbox = scriptedSandbox({ run: { stdout: `${prefix}😀` } });

    await expect(
      executeSandboxProgram({ code: "unicode", language: "ruby", runId: randomUUID(), sandbox }),
    ).resolves.toMatchObject({ output: `${prefix}�`, stop: "tooMuchOutput" });
  });

  it.each([
    ["cpp", "main.cpp:8:2: error"],
    ["csharp", "/tmp/Program.cs(8,23): error"],
    ["go", "./main.go:8:2: undefined"],
    ["java", "Main.java:8: error"],
    ["kotlin", "Main.kt:8:9: error"],
    ["php", "Parse error in main.php on line 8"],
    ["ruby", "main.rb:8: syntax error"],
    ["rust", "--> main.rs:8:9"],
    ["swift", "main.swift:8:16: error"],
    ["typescript", "main.ts(8,5): error"],
  ] as const)("reads the source line for %s", (language, diagnostics) => {
    expect(sandboxRunError(language, diagnostics).line).toBe(8);
  });

  it.each([
    [
      "cpp",
      "main.cpp: In function 'int main()':\nmain.cpp:8:2: error: expected ';' before 'return'\n    8 |  return 0;",
      "expected ';' before 'return'",
    ],
    ["csharp", "/tmp/Program.cs(8,23): error CS1002: ; expected [/tmp/cs.csproj]", "; expected"],
    ["go", "# command-line-arguments\n./main.go:8:2: undefined: x", "undefined: x"],
    [
      "java",
      "Main.java:8: error: ';' expected\n        int x = 1\n                 ^\n1 error",
      "';' expected",
    ],
    ["kotlin", "Main.kt:8:9: error: unresolved reference 'x'.", "unresolved reference 'x'."],
    [
      "rust",
      "error[E0425]: cannot find value `x` in this scope\n --> main.rs:8:9\n  |",
      "cannot find value `x` in this scope",
    ],
    ["typescript", "main.ts(8,5): error TS2304: Cannot find name 'x'.", "Cannot find name 'x'."],
    [
      "java",
      'Exception in thread "main" java.lang.ArithmeticException: / by zero\n\tat Main.main(Main.java:8)',
      'Exception in thread "main" java.lang.ArithmeticException: / by zero',
    ],
  ] as const)("names only the error in %s diagnostics", (language, diagnostics, message) => {
    expect(sandboxRunError(language, diagnostics).message).toBe(message);
  });
});
