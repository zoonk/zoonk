import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { countStaffRecords } from "./records";
import { findStaffUser } from "./users";

vi.mock("./get-staff-actor", () => ({
  getStaffActor: async () => ({ clientId: "zoonk-cli", status: "ready", userId: "staff-fixture" }),
}));

describe("staff query failures", () => {
  it.each([
    { field: "hour", model: "LearningEvent", value: "40000" },
    { field: "name", model: "User", value: "private\0text" },
    { field: "createdAt", model: "User", value: "0000-01-01T00:00:00Z" },
  ])("rejects an invalid $model value in $field", async ({ field, model, value }) => {
    await expect(
      countStaffRecords({ model, where: [{ field, op: "eq", value }] }),
    ).resolves.toStrictEqual({
      message: "A value in this request doesn't fit its column.",
      status: "invalid",
    });
  });

  it("uses a neutral value error for a NUL byte in user lookup", async () => {
    await expect(findStaffUser({ query: "private\0text" })).resolves.toStrictEqual({
      message: "A value in this request doesn't fit its column.",
      status: "invalid",
    });
  });

  it.each(["in", "notIn"])("caps %s at 1000 values", async (op) => {
    const id = randomUUID();

    await expect(
      countStaffRecords({
        model: "User",
        where: [{ field: "id", op, value: Array.from({ length: 1000 }, () => id) }],
      }),
    ).resolves.toMatchObject({ status: "ready" });

    await expect(
      countStaffRecords({
        model: "User",
        where: [{ field: "id", op, value: Array.from({ length: 1001 }, () => id) }],
      }),
    ).resolves.toMatchObject({ message: expect.stringContaining("1000"), status: "invalid" });
  });

  it("reports a real Prisma bind-limit failure across individually valid filters", async () => {
    const ids = Array.from({ length: 70_000 }, () => randomUUID());

    const result = await countStaffRecords({
      model: "User",
      where: Array.from({ length: 70 }, (_, index) => ({
        field: "id",
        op: "in",
        value: ids.slice(index * 1000, (index + 1) * 1000),
      })),
    });

    expect(result).toStrictEqual({
      message: "Too many filter values in one request.",
      status: "invalid",
    });
  });
});
