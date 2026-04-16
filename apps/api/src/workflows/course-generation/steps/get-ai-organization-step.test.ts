import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getAIOrganizationStep } from "./get-ai-organization-step";

vi.mock("workflow", () => ({
  FatalError: class FatalError extends Error {},
  getWorkflowMetadata: vi.fn().mockReturnValue({ workflowRunId: "test-run-id" }),
  getWritable: vi.fn().mockReturnValue({
    getWriter: () => ({
      releaseLock: vi.fn(),
      write: vi.fn().mockResolvedValue(null),
    }),
  }),
  workflowStep: vi.fn().mockImplementation((_name: string, fn: unknown) => fn),
}));

describe(getAIOrganizationStep, () => {
  let expectedOrgId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    expectedOrgId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the AI organization ID", async () => {
    const result = await getAIOrganizationStep();

    expect(result.id).toBe(expectedOrgId);
  });
});
