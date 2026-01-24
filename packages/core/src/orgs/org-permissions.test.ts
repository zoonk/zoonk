import { signInAs } from "@zoonk/testing/fixtures/auth";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { hasCoursePermission } from "./org-permissions";

describe("unauthenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  test("returns false for any permission using orgId", async () => {
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

    expect(canCreate).toBeFalsy();
    expect(canRead).toBeFalsy();
    expect(canUpdate).toBeFalsy();
    expect(canDelete).toBeFalsy();
  });

  test("returns false for any permission using orgSlug", async () => {
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

    expect(canCreate).toBeFalsy();
    expect(canRead).toBeFalsy();
    expect(canUpdate).toBeFalsy();
    expect(canDelete).toBeFalsy();
  });

  test("returns false when orgSlug does not exist", async () => {
    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgSlug: "non-existent-slug",
      permission: "create",
    });

    expect(canCreate).toBeFalsy();
  });

  test("returns false when orgId does not exist", async () => {
    const canCreate = await hasCoursePermission({
      headers: new Headers(),
      orgId: -1,
      permission: "create",
    });

    expect(canCreate).toBeFalsy();
  });
});

describe("member role", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "member" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("can read courses", async () => {
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("cannot create courses", async () => {
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBeFalsy();
  });

  test("cannot update courses", async () => {
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBeFalsy();
  });

  test("cannot delete courses", async () => {
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBeFalsy();
  });
});

describe("admin role", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("can create courses", async () => {
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBe(true);
  });

  test("can read courses", async () => {
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("can update courses", async () => {
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBe(true);
  });

  test("cannot delete courses", async () => {
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBeFalsy();
  });
});

describe("owner role", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "owner" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("can create courses", async () => {
    const canCreate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "create",
    });

    expect(canCreate).toBe(true);
  });

  test("can read courses", async () => {
    const canRead = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "read",
    });

    expect(canRead).toBe(true);
  });

  test("can update courses", async () => {
    const canUpdate = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "update",
    });

    expect(canUpdate).toBe(true);
  });

  test("can delete courses", async () => {
    const canDelete = await hasCoursePermission({
      headers,
      orgId: organization.id,
      permission: "delete",
    });

    expect(canDelete).toBe(true);
  });
});
