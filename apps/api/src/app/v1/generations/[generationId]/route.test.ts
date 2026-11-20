import { describe, expect, it, vi } from "vitest";
import { getRun } from "workflow/api";
import { GET as getGeneration } from "./route";

describe("GET /v1/generations/{generationId}", () => {
  it("identifies a completed writing prompt run", async () => {
    const generationId = "wrun_writing_prompt";

    vi.mocked(getRun, { partial: true }).mockReturnValue({
      exists: Promise.resolve(true),
      status: Promise.resolve("completed"),
      workflowName: Promise.resolve(
        "workflow//./src/workflows/sessions/writing-prompt-workflow//writingPromptWorkflow",
      ),
    });

    const response = await getGeneration(
      new Request(`http://localhost/v1/generations/${generationId}`),
      { params: Promise.resolve({ generationId }) },
    );

    expect(response.status).toBe(200);

    await expect(response.json()).resolves.toStrictEqual({
      id: generationId,
      kind: "writingPrompt",
      status: "completed",
    });
  });
});
