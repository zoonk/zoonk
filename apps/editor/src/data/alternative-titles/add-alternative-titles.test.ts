import { randomUUID } from "node:crypto";
import { ErrorCode } from "@/lib/app-error";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { memberFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, test } from "vitest";
import { addAlternativeTitles } from "./add-alternative-titles";

describe("unauthenticated users", () => {
  test("returns Forbidden", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ organizationId: organization.id });

    const result = await addAlternativeTitles({
      courseId: course.id,
      headers: new Headers(),
      language: "en",
      titles: ["test-title"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("members", () => {
  test("returns Forbidden", async () => {
    const { organization, user } = await memberFixture({ role: "member" });

    const [headers, course] = await Promise.all([
      signInAs(user.email, user.password),
      courseFixture({ organizationId: organization.id }),
    ]);

    const result = await addAlternativeTitles({
      courseId: course.id,
      headers,
      language: "en",
      titles: ["test-title"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});

describe("admins", () => {
  let organization: Awaited<ReturnType<typeof memberFixture>>["organization"];
  let headers: Headers;

  beforeAll(async () => {
    const fixture = await memberFixture({ role: "admin" });
    organization = fixture.organization;
    headers = await signInAs(fixture.user.email, fixture.user.password);
  });

  test("adds alternative titles successfully", async () => {
    const course = await courseFixture({ organizationId: organization.id });
    const suffix = randomUUID().slice(0, 8);

    const result = await addAlternativeTitles({
      courseId: course.id,
      headers,
      language: "en",
      titles: [`Test Title ${suffix}`],
    });

    expect(result.error).toBeNull();
    expect(result.data?.count).toBe(1);
  });

  test("returns Forbidden for course in different organization", async () => {
    const otherOrg = await organizationFixture();
    const course = await courseFixture({ organizationId: otherOrg.id });

    const result = await addAlternativeTitles({
      courseId: course.id,
      headers,
      language: "en",
      titles: ["test-title"],
    });

    expect(result.error?.message).toBe(ErrorCode.forbidden);
    expect(result.data).toBeNull();
  });
});
