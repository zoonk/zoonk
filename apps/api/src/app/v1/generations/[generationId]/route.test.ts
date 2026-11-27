import { describe, expect, it } from "vitest";
import { WorkflowRunNotFoundError } from "workflow/errors";
import { mockLastRunEvent, mockRunRecord } from "../../../../../mocks/workflow-runtime";
import { GET as getGeneration } from "./route";

describe("GET /v1/generations/{generationId}", () => {
  it("returns a retryable service error if the workflow store is unavailable", async () => {
    const generationId = "wrun_unavailable";
    mockRunRecord.mockRejectedValueOnce(new Error("Workflow storage unavailable"));

    const response = await getGeneration(
      new Request(`http://localhost/v1/generations/${generationId}`),
      { params: Promise.resolve({ generationId }) },
    );

    expect(response.status).toBe(503);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "SERVICE_UNAVAILABLE" },
    });
  });

  it("returns 404 only for a confirmed missing generation", async () => {
    const generationId = "wrun_missing";
    mockRunRecord.mockRejectedValueOnce(new WorkflowRunNotFoundError(generationId));

    const response = await getGeneration(
      new Request(`http://localhost/v1/generations/${generationId}`),
      { params: Promise.resolve({ generationId }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: { code: "NOT_FOUND" } });
  });

  it("returns failed for a stalled generation", async () => {
    const generationId = "wrun_stalled";
    mockRunRecord.mockResolvedValueOnce({ status: "running", workflowName: "lessonWorkflow" });

    mockLastRunEvent(generationId, {
      createdAt: new Date(Date.now() - 31 * 60 * 1000),
      eventType: "step_started",
    });

    const response = await getGeneration(
      new Request(`http://localhost/v1/generations/${generationId}`),
      { params: Promise.resolve({ generationId }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ status: "failed" });
  });

  it("identifies a completed writing prompt run", async () => {
    const generationId = "wrun_writing_prompt";

    mockRunRecord.mockResolvedValueOnce({
      status: "completed",
      workflowName:
        "workflow//./src/workflows/sessions/writing-prompt-workflow//writingDrillWorkflow",
    });

    const response = await getGeneration(
      new Request(`http://localhost/v1/generations/${generationId}`),
      { params: Promise.resolve({ generationId }) },
    );

    expect(mockRunRecord).toHaveBeenCalledExactlyOnceWith(generationId, { resolveData: "none" });
    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      id: generationId,
      kind: "writingPrompt",
      status: "completed",
      unit: "drill",
    });
  });
});
