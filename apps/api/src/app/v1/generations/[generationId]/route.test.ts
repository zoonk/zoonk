import { describe, expect, it } from "vitest";
import { mockRunRecord } from "../../../../../mocks/workflow-runtime";
import { GET as getGeneration } from "./route";

describe("GET /v1/generations/{generationId}", () => {
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
