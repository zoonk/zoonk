import { describe, expect, test } from "vitest";
import { organizationFixture } from "../test/fixtures/organizations";
import { getOrganizationId } from "./organizations";

describe("getOrganizationId()", () => {
  test("returns the organization id for a valid slug", async () => {
    const org = await organizationFixture();
    const result = await getOrganizationId(org.slug);

    expect(result.data).toBe(org.id);
    expect(result.error).toBeNull();
  });

  test("returns null when organization is not found", async () => {
    const result = await getOrganizationId("non-existent-slug");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
