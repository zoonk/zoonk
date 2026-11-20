import { randomUUID } from "node:crypto";
import { submitEssay } from "@zoonk/core/exams/essays/submit";
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { POST as postSubmission } from "./route";

vi.mock("@zoonk/core/exams/essays/submit", () => ({ submitEssay: vi.fn() }));

const blockId = randomUUID();
const draft = { durationMs: 1000, text: "This is my response.", timeZone: "UTC" };

function submit(body: object) {
  return postSubmission(
    new NextRequest(`http://localhost/v1/essays/${blockId}/submissions`, {
      body: JSON.stringify(body),
      method: "POST",
    }),
    { params: Promise.resolve({ blockId }) },
  );
}

describe("POST /v1/essays/{blockId}/submissions", () => {
  it("refuses a missing admission before grading", async () => {
    const response = await submit(draft);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    expect(submitEssay).not.toHaveBeenCalled();
  });

  it("returns a levels result without a synthetic score", async () => {
    const grade = {
      criteria: [],
      errors: [],
      ignoredFrom: null,
      kind: "levels" as const,
      nextStep: null,
      progress: null,
    };

    vi.mocked(submitEssay).mockResolvedValue({ grade, status: "writingGraded" });

    const input = { ...draft, admissionId: randomUUID() };
    const response = await submit(input);

    expect(response.status).toBe(200);
    expect(submitEssay).toHaveBeenLastCalledWith({ blockId, input });
    await expect(response.json()).resolves.toStrictEqual(grade);
  });
});
