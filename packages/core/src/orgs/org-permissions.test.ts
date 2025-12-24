import { describe, expect, test } from "vitest";
import { signInAs } from "@/fixtures/auth";
import { memberFixture, organizationFixture } from "@/fixtures/orgs";
import { hasCoursePermission } from "./org-permissions";

describe("unauthenticated users", () => {
  test("returns false for any permission using orgId", async () => {
    const organization = await organizationFixture();

    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgId: organization.id,
      permission: "create",
    });

    const canRead = await hasCoursePermission({
      headers: new Headers(),
      orgId: organization.id,
      permission: "read",
    });

    const canUpdate = await hasCoursePermission({
      headers: new Headers(),
      orgId: organization.id,
      permission: "update",
    });

    const canDelete = await hasCoursePermission({
      headers: new Headers(),
      orgId: organization.id,
      permission: "delete",
    });

    expect(canCreate).toBe(false);
    expect(canRead).toBe(false);
    expect(canUpdate).toBe(false);
    expect(canDelete).toBe(false);
  });

  test("returns false for any permission using orgSlug", async () => {
    const organization = await organizationFixture();

    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: organization.slug,
      permission: "create",
    });

    const canRead = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: organization.slug,
      permission: "read",
    });

    const canUpdate = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: organization.slug,
      permission: "update",
    });

    const canDelete = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: organization.slug,
      permission: "delete",
    });

    expect(canCreate).toBe(false);
    expect(canRead).toBe(false);
    expect(canUpdate).toBe(false);
    expect(canDelete).toBe(false);
  });

  test("returns false when orgSlug does not exist", async () => {
    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: "non-existent-slug",
      permission: "create",
    });

    expect(canCreate).toBe(false);
  });

  test("returns false when orgId does not exist", async () => {
    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgId: -1,
      permission: "create",
    });

    expect(canCreate).toBe(false);
  });
});

describe("member role", () => {
  test("can read courses", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("cannot create courses", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBe(false);
  });

  test("cannot update courses", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBe(false);
  });

  test("cannot delete courses", async () => {
    const { organization, user } = await memberFixture({ role: "member" });
    const headers = await signInAs(user.email, user.password);
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBe(false);
  });
});

describe("admin role", () => {
  test("can create courses", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBe(true);
  });

  test("can read courses", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("can update courses", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBe(true);
  });

  test("cannot delete courses", async () => {
    const { organization, user } = await memberFixture({ role: "admin" });
    const headers = await signInAs(user.email, user.password);
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBe(false);
  });
});

describe("owner role", () => {
  test("can create courses", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBe(true);
  });

  test("can read courses", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("can update courses", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBe(true);
  });

  test("can delete courses", async () => {
    const { organization, user } = await memberFixture({ role: "owner" });
    const headers = await signInAs(user.email, user.password);
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBe(true);
  });
});
