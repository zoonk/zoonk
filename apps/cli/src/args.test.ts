import { describe, expect, it } from "vitest";
import { parseInvocation } from "./args.ts";
import { EXIT_CODES } from "./errors.ts";

function sentRequest(argv: string[]) {
  const { command } = parseInvocation(argv);

  if (command.name !== "request") {
    return command;
  }

  const sentJson = JSON.stringify(command.request);
  const sent: unknown = JSON.parse(sentJson);

  return sent;
}

describe(parseInvocation, () => {
  it("turns list filters into the request body", () => {
    expect(
      sentRequest([
        "staff",
        "list",
        "Goal",
        "--where",
        "userId eq 0b5e1c1a-1f0e-4f5e-9d37-6c2f3a1b9e10",
        "--where",
        "status in active, paused",
        "--where",
        "archivedAt isNull",
        "--where",
        "title eq Learn Portuguese",
        "--order",
        "createdAt:desc",
        "--limit",
        "5",
        "--offset",
        "10",
      ]),
    ).toStrictEqual({
      body: {
        limit: 5,
        model: "Goal",
        offset: 10,
        orderBy: { direction: "desc", field: "createdAt" },
        where: [
          { field: "userId", op: "eq", value: "0b5e1c1a-1f0e-4f5e-9d37-6c2f3a1b9e10" },
          { field: "status", op: "in", value: ["active", "paused"] },
          { field: "archivedAt", op: "isNull" },
          { field: "title", op: "eq", value: "Learn Portuguese" },
        ],
      },
      method: "POST",
      path: "/staff/records/list",
    });
  });

  it("maps each command to its staff route", () => {
    expect(sentRequest(["whoami"])).toStrictEqual({ method: "GET", path: "/staff/me" });

    expect(sentRequest(["staff", "models"])).toStrictEqual({
      method: "GET",
      path: "/staff/models",
    });

    expect(sentRequest(["staff", "users", "find", "ana@example.com"])).toStrictEqual({
      body: { query: "ana@example.com" },
      method: "POST",
      path: "/staff/users/find",
    });

    expect(sentRequest(["staff", "users", "search", "ana", "lima", "--limit", "3"])).toStrictEqual({
      body: { limit: 3, query: "ana lima" },
      method: "POST",
      path: "/staff/users/search",
    });

    expect(sentRequest(["staff", "get", "Goal", "abc"])).toStrictEqual({
      body: { id: "abc", model: "Goal" },
      method: "POST",
      path: "/staff/records/get",
    });

    expect(sentRequest(["staff", "count", "Goal", "--where", "userId eq abc"])).toStrictEqual({
      body: { model: "Goal", where: [{ field: "userId", op: "eq", value: "abc" }] },
      method: "POST",
      path: "/staff/records/count",
    });
  });

  it("reads --api on any command", () => {
    expect(parseInvocation(["logout", "--api", "http://localhost:3001"])).toStrictEqual({
      apiUrl: "http://localhost:3001",
      command: { name: "logout" },
    });
  });

  it.each([
    [["staff", "list", "Goal", "--where", "status like active"]],
    [["staff", "list", "Goal", "--where", "archivedAt isNull yes"]],
    [["staff", "list", "Goal", "--where", "status eq"]],
    [["staff", "list", "Goal", "--limit", "ten"]],
    [["staff", "list", "Goal", "--order", "createdAt:newest"]],
    [["staff", "get", "Goal", "abc", "--where", "id eq abc"]],
    [["staff", "get", "Goal"]],
    [["staff", "users", "search"]],
    [["staff", "drop", "Goal"]],
    [["staff", "list", "Goal", "--unknown"]],
  ])("rejects %j as wrong usage", (argv) => {
    expect(() => parseInvocation(argv)).toThrow(
      expect.objectContaining({ exitCode: EXIT_CODES.usage }),
    );
  });
});
