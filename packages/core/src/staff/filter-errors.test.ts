import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { staffRead, staffTransaction } from "./read";
import { countStaffRecords } from "./records";

vi.mock("./get-staff-actor", () => ({
  getStaffActor: async () => ({ clientId: "zoonk-cli", status: "ready", userId: "staff-fixture" }),
}));

describe("staff filter failures", () => {
  it.each([
    { field: "hour", model: "LearningEvent", value: "40000" },
    { field: "name", model: "User", value: "private\0text" },
    { field: "createdAt", model: "User", value: "0000-01-01T00:00:00Z" },
  ])("rejects a value outside $model.$field's database format", async ({ field, model, value }) => {
    await expect(
      countStaffRecords({ model, where: [{ field, op: "eq", value }] }),
    ).resolves.toStrictEqual({
      message: "A filter value doesn't fit its column.",
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

  it("turns a real Prisma bind-limit failure into a value error", async () => {
    const ids = Array.from({ length: 70_000 }, () => randomUUID());

    const result = await staffRead({
      call: { model: "User", verb: "count" },
      run: async () => {
        const count = await staffTransaction((client) =>
          client.user.count({ where: { id: { in: ids } } }),
        );

        return { data: { count }, rows: count };
      },
    });

    expect(result).toStrictEqual({
      message: "A filter value doesn't fit its column.",
      status: "invalid",
    });
  });
});
