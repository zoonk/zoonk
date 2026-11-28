import { readFile } from "node:fs/promises";
import { runLearnerProgram } from "@zoonk/core/library/activities/run-learner-program";
import { describe, expect, it, vi } from "vitest";
import { POST as postCodeRun } from "./route";

vi.mock("@zoonk/core/library/activities/run-learner-program", () => ({
  runLearnerProgram: vi.fn(),
}));

const requestId = "afff9e26-a25b-4dba-adb3-18673729ab25";

const result = {
  error: null,
  errorOutput: "",
  output: "hello\n",
  runId: "ec8eedd5-7adf-48aa-b686-ed38e40340b5",
  stop: "done",
} as const;

function request(input: { code?: string; language?: string } = {}) {
  return new Request("https://api.example.test/v1/code-runs", {
    body: JSON.stringify({ code: "hello", language: "java", requestId, ...input }),
    method: "POST",
  });
}

describe("POST /v1/code-runs", () => {
  it("returns the same SSE frames the players decode", async () => {
    vi.mocked(runLearnerProgram).mockResolvedValueOnce({
      run: (phase) => {
        phase("starting");
        phase("compiling");
        phase("running");
        return Promise.resolve(result);
      },
      status: "start",
    });

    const response = await postCodeRun(request());

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const fixture = await readFile(
      new URL(
        "../../../../../../packages/core/src/library/activities/programs/code-run-events.json",
        import.meta.url,
      ),
      "utf8",
    );

    const expected: unknown = JSON.parse(fixture);
    await expect(response.text()).resolves.toBe(expected);
  });

  it("streams a replay as a sole result frame", async () => {
    vi.mocked(runLearnerProgram).mockResolvedValueOnce({ result, status: "replay" });
    const response = await postCodeRun(request());

    await expect(response.text()).resolves.toBe(
      `event: result\ndata: ${JSON.stringify(result)}\n\n`,
    );
  });

  it.each([
    { code: "UNAUTHORIZED", decision: { status: "unauthorized" }, status: 401 },
    { code: "ALREADY_RUNNING", decision: { status: "alreadyRunning" }, status: 409 },
    { code: "SIGN_UP_REQUIRED", decision: { status: "signUpRequired" }, status: 403 },
    { code: "SLOW_DOWN", decision: { retryAfterSeconds: 5, status: "slowDown" }, status: 429 },
  ] as const)(
    "returns $status with $code before opening a stream",
    async ({ code, decision, status }) => {
      vi.mocked(runLearnerProgram).mockResolvedValueOnce(decision);
      const response = await postCodeRun(request());
      expect(response.status).toBe(status);
      await expect(response.json()).resolves.toMatchObject({ error: { code } });
    },
  );

  it.each([
    ["free", 402],
    ["guest", 403],
    ["plus", 429],
  ] as const)("returns the %s plan limit and its resource", async (tier, status) => {
    const limit = { limit: 15, period: "day", resource: "codeRun", tier } as const;
    vi.mocked(runLearnerProgram).mockResolvedValueOnce({ limit, status: "limitReached" });
    const response = await postCodeRun(request());
    expect(response.status).toBe(status);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "USAGE_LIMIT_REACHED", details: { limit } },
    });
  });

  it.each([{ language: "javascript" }, { code: "é".repeat(32_769) }])(
    "refuses invalid requests before admission",
    async (input) => {
      const response = await postCodeRun(request(input));
      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
      expect(runLearnerProgram).not.toHaveBeenCalled();
    },
  );
});
