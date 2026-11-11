import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { describe, expect, it, vi } from "vitest";
import { staffCredentialPolicy } from "./policy";
import { countStaffRecords, getStaffRecord, listStaffRecords } from "./records";

const { excludedModels, strippedFields } = staffCredentialPolicy;

// The API route suite verifies real CLI tokens; these tests isolate scalar queries.
vi.mock("./get-staff-actor", () => ({
  getStaffActor: async () => ({ clientId: "zoonk-cli", status: "ready", userId: "staff-fixture" }),
}));

describe("staff scalar queries", () => {
  it("refuses every excluded model and every stripped field for filters and ordering", async () => {
    await Promise.all(
      excludedModels.map(async (model) => {
        await expect(getStaffRecord({ id: randomUUID(), model })).resolves.toMatchObject({
          status: "invalid",
        });

        await expect(listStaffRecords({ model })).resolves.toMatchObject({ status: "invalid" });
        await expect(countStaffRecords({ model })).resolves.toMatchObject({ status: "invalid" });
      }),
    );

    await Promise.all(
      Object.entries(strippedFields).flatMap(([model, fields]) =>
        fields.map(async (field) => {
          const input = { model, where: [{ field, op: "eq", value: "never-log-this-value" }] };

          await expect(countStaffRecords(input)).resolves.toMatchObject({
            message: expect.stringContaining("not readable"),
            status: "invalid",
          });

          await expect(listStaffRecords(input)).resolves.toMatchObject({ status: "invalid" });

          await expect(
            listStaffRecords({ model, orderBy: { direction: "asc", field } }),
          ).resolves.toMatchObject({ status: "invalid" });
        }),
      ),
    );
  });

  it.each([
    { field: "lastRequest", model: "RateLimit", value: "not-a-number" },
    { field: "lastRequest", model: "RateLimit", value: "9223372036854775808" },
    { field: "count", model: "RateLimit", value: 2_147_483_648 },
    { field: "id", model: "User", value: "not-a-uuid" },
    { field: "createdAt", model: "User", value: "not-a-date" },
    { field: "emailVerified", model: "User", value: "not-a-boolean" },
    { field: "kind", model: "FollowUp", value: "not-a-kind" },
    { field: "count", model: "RateLimit", value: "" },
    { field: "costUsd", model: "AiCall", value: "not-a-number" },
    { field: "input", model: "FollowUp", value: "not-json" },
  ])("rejects a bad $model.$field value before Prisma", async ({ field, model, value }) => {
    await expect(
      countStaffRecords({ model, where: [{ field, op: "eq", value }] }),
    ).resolves.toMatchObject({
      message: expect.stringContaining(`Invalid value for ${field}. Expected`),
      status: "invalid",
    });
  });

  it("coerces CLI string values and membership arrays to their scalar types", async () => {
    const rate = await prisma.rateLimit.create({
      data: { count: 7, key: randomUUID(), lastRequest: 99n },
    });

    await expect(
      countStaffRecords({
        model: "RateLimit",
        where: [
          { field: "id", op: "eq", value: rate.id },
          { field: "count", op: "in", value: ["6", "7"] },
          { field: "lastRequest", op: "gt", value: "98" },
        ],
      }),
    ).resolves.toMatchObject({ count: 1, status: "ready" });

    const user = await userFixture();

    await expect(
      countStaffRecords({
        model: "User",
        where: [
          { field: "id", op: "eq", value: user.id },
          { field: "emailVerified", op: "eq", value: "false" },
          { field: "createdAt", op: "gt", value: "2020-01-01" },
        ],
      }),
    ).resolves.toMatchObject({ count: 1, status: "ready" });
  });

  it("supports JSON equality and enum values without interpreting nested Prisma input", async () => {
    const user = await userFixture();
    const input = { nested: { contains: "just data" }, values: [true, 3, null] };

    const row = await prisma.followUp.create({
      data: { input, key: randomUUID(), kind: "prepareSession", userId: user.id },
    });

    const where = [
      { field: "userId", op: "eq", value: user.id },
      { field: "kind", op: "eq", value: "prepareSession" },
      { field: "input", op: "eq", value: JSON.stringify(input) },
    ];

    await expect(countStaffRecords({ model: "FollowUp", where })).resolves.toMatchObject({
      count: 1,
      status: "ready",
    });

    await expect(getStaffRecord({ id: row.id, model: "FollowUp" })).resolves.toMatchObject({
      record: { input },
      status: "ready",
    });
  });

  it("filters scalar lists by equality and rejects unsupported list operations", async () => {
    const user = await userFixture();

    await prisma.userLearningProfile.create({
      data: { learningNeeds: ["plainWords"], userId: user.id },
    });

    const where = [
      { field: "userId", op: "eq", value: user.id },
      { field: "learningNeeds", op: "eq", value: JSON.stringify(["plainWords"]) },
    ];

    await expect(countStaffRecords({ model: "UserLearningProfile", where })).resolves.toMatchObject(
      { count: 1, status: "ready" },
    );

    await expect(
      countStaffRecords({
        model: "UserLearningProfile",
        where: [{ field: "learningNeeds", op: "in", value: ["plainWords"] }],
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining("Valid operations: eq"),
      status: "invalid",
    });
  });
});
