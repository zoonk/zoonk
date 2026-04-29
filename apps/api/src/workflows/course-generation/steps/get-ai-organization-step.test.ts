import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { getAIOrganizationStep } from "./get-ai-organization-step";

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
