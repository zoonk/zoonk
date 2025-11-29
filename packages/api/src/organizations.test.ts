import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import {
  memberFixture,
  organizationFixture,
} from "../test/fixtures/organizations";
import { canUpdateCourses, getOrganizationId } from "./organizations";

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

describe("canUpdateCourses()", () => {
  test("returns false for users with member role", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await canUpdateCourses(organization.id, { headers });

    expect(canUpdate).toBe(false);
  });

  test("returns true for users with admin role", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await canUpdateCourses(organization.id, { headers });

    expect(canUpdate).toBe(true);
  });

  test("returns true for users with owner role", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await canUpdateCourses(organization.id, { headers });

    expect(canUpdate).toBe(true);
  });

  test("returns false for unauthenticated users", async () => {
    const organization = await organizationFixture();

    const canUpdate = await canUpdateCourses(organization.id, {
      headers: new Headers(),
    });

    expect(canUpdate).toBe(false);
  });
});
