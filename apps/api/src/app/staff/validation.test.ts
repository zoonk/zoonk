import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { signInStaff, staffRequest } from "./_test-utils/requests";
import { POST as countRecords } from "./records/count/route";
import { POST as getRecord } from "./records/get/route";
import { POST as listRecords } from "./records/list/route";

describe("staff request validation", () => {
  it.each([
    {
      field: "completedAt",
      model: "StudySession",
      where: [{ field: "completedAt", op: "isNull" }],
    },
    { field: "nope", model: "Goal", orderBy: { direction: "desc", field: "nope" } },
  ])("identifies the unreadable $field field", async ({ field, ...body }) => {
    await signInStaff();
    const response = await listRecords(staffRequest({ body, path: "/staff/records/list" }));
    expect(response.status).toBe(400);

    await expect(response.json()).resolves.toMatchObject({
      error: {
        message: expect.stringContaining(`Field "${field}" is not readable. Valid fields:`),
      },
    });
  });

  it("identifies the model when no record has the requested id", async () => {
    await signInStaff();

    const response = await getRecord(
      staffRequest({ body: { id: randomUUID(), model: "Goal" }, path: "/staff/records/get" }),
    );

    expect(response.status).toBe(404);

    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NOT_FOUND", message: "No Goal with that id." },
    });
  });

  it("names UUID formats and points null filters to the null operations", async () => {
    await signInStaff();

    const invalidId = await getRecord(
      staffRequest({ body: { id: "not-a-uuid", model: "Goal" }, path: "/staff/records/get" }),
    );

    expect(invalidId.status).toBe(400);

    await expect(invalidId.json()).resolves.toMatchObject({
      error: { message: expect.stringContaining("Expected UUID") },
    });

    await Promise.all(
      [null, "null", undefined].map(async (value) => {
        const response = await countRecords(
          staffRequest({
            body: { model: "User", where: [{ field: "username", op: "eq", value }] },
            path: "/staff/records/count",
          }),
        );

        expect(response.status).toBe(400);
        const text = JSON.stringify(await response.json());
        expect(text).toContain("isNull");
        expect(text).toContain("notNull");
      }),
    );
  });

  it("coerces CLI string values and string membership arrays before querying", async () => {
    await signInStaff();

    const row = await prisma.rateLimit.create({
      data: { count: 7, key: randomUUID(), lastRequest: 99n },
    });

    const response = await countRecords(
      staffRequest({
        body: {
          model: "RateLimit",
          where: [
            { field: "id", op: "eq", value: row.id },
            { field: "count", op: "in", value: ["6", "7"] },
            { field: "lastRequest", op: "gt", value: "98" },
          ],
        },
        path: "/staff/records/count",
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toStrictEqual({ count: 1 });
  });

  it("names valid models, fields, operations, enum values and scalar types", async () => {
    await signInStaff();

    const cases = [
      { body: { model: "NotAModel" }, options: ["Model is not readable", "Valid models:", "User"] },
      {
        body: {
          model: "User",
          where: [{ field: "notAField", op: "eq", value: "sensitive-input" }],
        },
        options: ["notAField", "is not readable", "Valid fields:", "email"],
      },
      {
        body: {
          model: "User",
          where: [{ field: "name", op: "contains", value: "sensitive-input" }],
        },
        options: ["eq", "ne", "isNull"],
      },
      {
        body: { model: "FollowUp", where: [{ field: "kind", op: "eq", value: "not-a-kind" }] },
        options: ["kind", "FollowUpKind", "Valid options:", "prepareSession"],
      },
      {
        body: {
          model: "RateLimit",
          where: [{ field: "count", op: "eq", value: "sensitive-input" }],
        },
        options: ["count", "Expected Int"],
      },
      {
        body: { model: "User", where: [{ field: "createdAt", op: "gte", value: "yesterday" }] },
        options: ["createdAt", "ISO 8601 date or date-time", "2026-11-10", "2026-11-10T12:00:00Z"],
      },
    ];

    await Promise.all(
      cases.map(async ({ body, options }) => {
        const response = await countRecords(staffRequest({ body, path: "/staff/records/count" }));
        expect(response.status).toBe(400);
        const text = JSON.stringify(await response.json());

        for (const option of options) {
          expect(text).toContain(option);
        }

        expect(text).not.toContain("sensitive-input");
      }),
    );
  });

  it("rejects malformed JSON and invalid numeric or sort input, then accepts a valid retry", async () => {
    const { user } = await signInStaff();

    const invalidBodies = [
      { limit: 101, model: "User" },
      { limit: "20", model: "User" },
      { model: "User", offset: -1 },
      { model: "User", orderBy: { direction: "sideways", field: "id" } },
      { model: "User", where: [{ field: "username", op: "isNull", value: "ignored-value" }] },
    ];

    const responses = await Promise.all(
      invalidBodies.map((body) => listRecords(staffRequest({ body, path: "/staff/records/list" }))),
    );

    expect(responses.map((response) => response.status)).toStrictEqual([400, 400, 400, 400, 400]);

    const malformed = await countRecords(
      new Request("http://localhost/staff/records/count", {
        body: "{broken",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(malformed.status).toBe(400);
    await expect(malformed.json()).resolves.toMatchObject({ error: { code: "BAD_REQUEST" } });

    const retry = await countRecords(
      staffRequest({
        body: { model: "User", where: [{ field: "id", op: "eq", value: user.id }] },
        path: "/staff/records/count",
      }),
    );

    expect(retry.status).toBe(200);
    await expect(retry.json()).resolves.toStrictEqual({ count: 1 });
  });
});
