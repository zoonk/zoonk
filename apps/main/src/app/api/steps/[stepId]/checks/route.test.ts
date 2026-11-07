import { describe, expect, it } from "vitest";
import { POST as postCheck } from "./route";

function sendCheck(body: unknown) {
  const request = new Request("http://localhost:9000/api/steps/step/checks", {
    body: JSON.stringify(body),
    headers: { Host: "localhost:9000", Origin: "http://localhost:9000" },
    method: "POST",
  });

  return postCheck(request, { params: Promise.resolve({ stepId: crypto.randomUUID() }) });
}

describe("lesson step check route", () => {
  it("answers a check sent without a session as a failure, so the player keeps the answer", async () => {
    const response = await sendCheck({
      answer: { kind: "check", optionId: "right" },
      attemptId: crypto.randomUUID(),
      durationMs: 4000,
      runId: crypto.randomUUID(),
      timeZone: "UTC",
    });

    await expect(response.json()).resolves.toStrictEqual({ status: "failed" });
  });

  it("refuses an answer no retry can fix", async () => {
    const response = await sendCheck({ answer: { kind: "check" } });
    await expect(response.json()).resolves.toStrictEqual({ status: "refused" });
  });
});
