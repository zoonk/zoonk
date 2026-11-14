import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("sends a fix file's proposal, a revert's reason and a withdrawal to their staff routes", () => {
    const folder = mkdtempSync(join(tmpdir(), "zoonk-cli-fix-"));
    const file = join(folder, "fix.json");

    const proposal = {
      changes: [{ id: "x", model: "Lesson", set: { title: "Fractions" } }],
      reason: "Typo.",
    };

    writeFileSync(file, JSON.stringify(proposal));

    expect(sentRequest(["staff", "fixes", "propose", file])).toStrictEqual({
      body: proposal,
      method: "POST",
      path: "/staff/content-fixes",
    });

    expect(
      sentRequest(["staff", "fixes", "revert", "fix-1", "--reason", "Wrong fix."]),
    ).toStrictEqual({
      body: { fixId: "fix-1", reason: "Wrong fix." },
      method: "POST",
      path: "/staff/content-fixes/revert",
    });

    expect(
      sentRequest(["staff", "fixes", "revert", "--batch", "batch-1", "--reason", "Wrong batch."]),
    ).toStrictEqual({
      body: { batchId: "batch-1", reason: "Wrong batch." },
      method: "POST",
      path: "/staff/content-fixes/revert",
    });

    expect(sentRequest(["staff", "fixes", "withdraw", "fix-1"])).toStrictEqual({
      body: { fixId: "fix-1" },
      method: "POST",
      path: "/staff/content-fixes/withdraw",
    });

    expect(sentRequest(["staff", "fixes", "withdraw", "--batch", "batch-1"])).toStrictEqual({
      body: { batchId: "batch-1" },
      method: "POST",
      path: "/staff/content-fixes/withdraw",
    });
  });

  it.each([
    [["staff", "fixes", "propose", "/no/such/fix.json"], "Can't read"],
    [["staff", "fixes", "revert", "fix-1"], "--reason"],
    [["staff", "fixes", "revert", "fix-1", "--batch", "b", "--reason", "x"], "--batch <batchId>"],
    [["staff", "fixes", "revert", "--reason", "x"], "--batch <batchId>"],
    [["staff", "fixes", "withdraw"], "--batch <batchId>"],
    [["staff", "fixes", "withdraw", "fix-1", "--reason", "x"], "no --reason option"],
  ])("refuses %j before sending anything", (argv, message) => {
    expect(() => parseInvocation(argv)).toThrow(
      expect.objectContaining({
        exitCode: EXIT_CODES.usage,
        message: expect.stringContaining(message),
      }),
    );
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

  it("keeps a value's spaces after the field and operator", () => {
    expect(sentRequest(["staff", "count", "Goal", "--where", "title eq  Learn  "])).toMatchObject({
      body: { where: [{ field: "title", op: "eq", value: " Learn  " }] },
    });
  });

  it("keeps what to print beside the request", () => {
    expect(parseInvocation(["staff", "models", "Goal", "Plan"]).command).toMatchObject({
      shape: { kind: "models", names: ["Goal", "Plan"] },
    });

    expect(
      parseInvocation(["staff", "list", "Goal", "--fields", "id, status,createdAt"]).command,
    ).toMatchObject({ shape: { fields: ["id", "status", "createdAt"], kind: "fields" } });
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
    [["staff", "list", "Goal", "--offset", "9007199254740993"]],
    [["staff", "list", "Goal", "--order", "createdAt:newest"]],
    [["staff", "get", "Goal", "abc", "--where", "id eq abc"]],
    [["staff", "get", "Goal"]],
    [["staff", "users", "search"]],
    [["staff", "drop", "Goal"]],
    [["staff", "list", "Goal", "--unknown"]],
    [["staff", "count", "Goal", "--fields", "id"]],
    [["staff", "list", "Goal", "--fields", ","]],
  ])("rejects %j as wrong usage", (argv) => {
    expect(() => parseInvocation(argv)).toThrow(
      expect.objectContaining({ exitCode: EXIT_CODES.usage }),
    );
  });

  it.each([
    [["staff", "get", "Goal"], "pnpm zoonk staff get <model> <id> [--fields ...]"],
    [["staff", "fixes", "revert"], 'pnpm zoonk staff fixes revert <fixId> --reason "…"'],
    [["staff", "fixes", "withdraw"], "pnpm zoonk staff fixes withdraw <fixId>"],
    [["whoami", "now"], "pnpm zoonk whoami"],
    [["staff", "list", "Goal", "--unknown"], "Unknown option '--unknown'.\nRun"],
  ])("says how %j should be written", (argv, message) => {
    expect(() => parseInvocation(argv)).toThrow(
      expect.objectContaining({ message: expect.stringContaining(message) }),
    );
  });
});
