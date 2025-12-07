import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import {
  memberFixture,
  organizationFixture,
} from "../test/fixtures/organizations";
import { getOrganizationId, hasCoursePermission } from "./organizations";

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

describe("hasCoursePermission()", () => {
  describe("unauthenticated users", () => {
    test("returns false for any permission", async () => {
      const organization = await organizationFixture();

      const canCreate = await hasCoursePermission(organization.id, "create", {
        headers: new Headers(),
      });

      const canRead = await hasCoursePermission(organization.id, "read", {
        headers: new Headers(),
      });

      const canUpdate = await hasCoursePermission(organization.id, "update", {
        headers: new Headers(),
      });

      const canDelete = await hasCoursePermission(organization.id, "delete", {
        headers: new Headers(),
      });

      expect(canCreate).toBe(false);
      expect(canRead).toBe(false);
      expect(canUpdate).toBe(false);
      expect(canDelete).toBe(false);
    });
  });

  describe("member role", () => {
    test("can read courses", async () => {
      const { organization, user } = await memberFixture({ role: "member" });
      const headers = await signInAs(user.email, user.password);
      const canRead = await hasCoursePermission(organization.id, "read", {
        headers,
      });

      expect(canRead).toBe(true);
    });

    test("cannot create courses", async () => {
      const { organization, user } = await memberFixture({ role: "member" });
      const headers = await signInAs(user.email, user.password);
      const canCreate = await hasCoursePermission(organization.id, "create", {
        headers,
      });

      expect(canCreate).toBe(false);
    });

    test("cannot update courses", async () => {
      const { organization, user } = await memberFixture({ role: "member" });
      const headers = await signInAs(user.email, user.password);
      const canUpdate = await hasCoursePermission(organization.id, "update", {
        headers,
      });

      expect(canUpdate).toBe(false);
    });

    test("cannot delete courses", async () => {
      const { organization, user } = await memberFixture({ role: "member" });
      const headers = await signInAs(user.email, user.password);
      const canDelete = await hasCoursePermission(organization.id, "delete", {
        headers,
      });

      expect(canDelete).toBe(false);
    });
  });

  describe("admin role", () => {
    test("can create courses", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const canCreate = await hasCoursePermission(organization.id, "create", {
        headers,
      });

      expect(canCreate).toBe(true);
    });

    test("can read courses", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const canRead = await hasCoursePermission(organization.id, "read", {
        headers,
      });

      expect(canRead).toBe(true);
    });

    test("can update courses", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const canUpdate = await hasCoursePermission(organization.id, "update", {
        headers,
      });

      expect(canUpdate).toBe(true);
    });

    test("cannot delete courses", async () => {
      const { organization, user } = await memberFixture({ role: "admin" });
      const headers = await signInAs(user.email, user.password);
      const canDelete = await hasCoursePermission(organization.id, "delete", {
        headers,
      });

      expect(canDelete).toBe(false);
    });
  });

  describe("owner role", () => {
    test("can create courses", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);
      const canCreate = await hasCoursePermission(organization.id, "create", {
        headers,
      });

      expect(canCreate).toBe(true);
    });

    test("can read courses", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);
      const canRead = await hasCoursePermission(organization.id, "read", {
        headers,
      });

      expect(canRead).toBe(true);
    });

    test("can update courses", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);
      const canUpdate = await hasCoursePermission(organization.id, "update", {
        headers,
      });

      expect(canUpdate).toBe(true);
    });

    test("can delete courses", async () => {
      const { organization, user } = await memberFixture({ role: "owner" });
      const headers = await signInAs(user.email, user.password);
      const canDelete = await hasCoursePermission(organization.id, "delete", {
        headers,
      });

      expect(canDelete).toBe(true);
    });
  });
});
