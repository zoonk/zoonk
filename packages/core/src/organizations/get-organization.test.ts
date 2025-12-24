import { expect, test } from "vitest";
import { organizationFixture } from "@/fixtures/organizations";
import { getOrganization } from "./get-organization";

test("returns the organization id for a valid slug", async () => {
  const org = await organizationFixture();
  const result = await getOrganization(org.slug);

  expect(result.data).toEqual(org);
  expect(result.error).toBeNull();
});

test("returns null when organization is not found", async () => {
  const result = await getOrganization("non-existent-slug");

  expect(result.data).toBeNull();
  expect(result.error).toBeNull();
});
