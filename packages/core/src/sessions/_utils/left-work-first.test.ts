import { type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { putLeftWorkFirst } from "./left-work-first";

function item({
  id,
  kind = "lesson",
  skillId = null,
  status = "todo",
}: {
  id: string;
  kind?: PlanItemKind;
  skillId?: string | null;
  status?: PlanItemStatus;
}) {
  return { chapterId: null, id, kind, skillId, status };
}

function order(
  items: readonly ReturnType<typeof item>[],
  leftIds: readonly string[],
): (string | null)[] {
  return putLeftWorkFirst({
    items: items.map((entry, position) => ({ ...entry, position })),
    left: leftIds.map((id) => ({ id })),
  }).map((entry) => entry.id);
}

describe(putLeftWorkFirst, () => {
  it("puts lessons an earlier day left before today's own", () => {
    const items = [
      item({ id: "today-a", skillId: "a" }),
      item({ id: "today-b", skillId: "b" }),
      item({ id: "left-c", skillId: "c" }),
    ];

    expect(order(items, ["left-c"])).toStrictEqual(["left-c", "today-a", "today-b"]);
  });

  it("takes the earlier lessons of the same skill along, so the skill stays in order", () => {
    const items = [
      item({ id: "a1", skillId: "a" }),
      item({ id: "b1", skillId: "b" }),
      item({ id: "a2-left", skillId: "a" }),
      item({ id: "a3", skillId: "a" }),
    ];

    expect(order(items, ["a2-left"])).toStrictEqual(["a1", "a2-left", "b1", "a3"]);
  });

  it("never moves a lesson past a challenge, and leaves finished work where it is", () => {
    const items = [
      item({ id: "done", skillId: "a", status: "done" }),
      item({ id: "a1", skillId: "a" }),
      item({ id: "boss", kind: "boss" }),
      item({ id: "b1", skillId: "b" }),
      item({ id: "a2-left", skillId: "a" }),
    ];

    expect(order(items, ["a2-left"])).toStrictEqual(["done", "a1", "boss", "a2-left", "b1"]);
  });
});
