import { type PlanItemKind, type PlanItemStatus } from "@zoonk/db";
import { describe, expect, it } from "vitest";
import { putLeftWorkFirst } from "./left-work-first";

function item({
  chapterId = null,
  id,
  kind = "lesson",
  skillId = null,
  status = "todo",
}: {
  chapterId?: string | null;
  id: string;
  kind?: PlanItemKind;
  skillId?: string | null;
  status?: PlanItemStatus;
}) {
  return { chapterId, id, kind, skillId, status };
}

function order({
  items,
  left,
  prerequisites = new Map(),
}: {
  items: readonly ReturnType<typeof item>[];
  left: readonly string[];
  prerequisites?: ReadonlyMap<string, readonly string[]>;
}): (string | null)[] {
  return putLeftWorkFirst({
    items: items.map((entry, position) => ({ ...entry, position })),
    left: left.map((id) => ({ id })),
    prerequisites,
  }).map((entry) => entry.id);
}

describe(putLeftWorkFirst, () => {
  it("puts lessons an earlier day left before today's own", () => {
    const items = [
      item({ id: "today-a", skillId: "a" }),
      item({ id: "today-b", skillId: "b" }),
      item({ id: "left-c", skillId: "c" }),
    ];

    expect(order({ items, left: ["left-c"] })).toStrictEqual(["left-c", "today-a", "today-b"]);
  });

  it("brings the earlier lessons of the same skill along, after left lessons that need none", () => {
    const items = [
      item({ id: "a1", skillId: "a" }),
      item({ id: "c1", skillId: "c" }),
      item({ id: "b1-left", skillId: "b" }),
      item({ id: "a2-left", skillId: "a" }),
    ];

    expect(order({ items, left: ["b1-left", "a2-left"] })).toStrictEqual([
      "b1-left",
      "a1",
      "a2-left",
      "c1",
    ]);
  });

  it("keeps a chapter in order even when its lessons teach different skills", () => {
    const items = [
      item({ chapterId: "cells", id: "cells-1", skillId: "theory" }),
      item({ chapterId: "cells", id: "cells-2-left", skillId: "organelles" }),
    ];

    expect(order({ items, left: ["cells-2-left"] })).toStrictEqual(["cells-1", "cells-2-left"]);
  });

  it("never passes a lesson of a skill it builds on, written or not", () => {
    const items = [
      item({ chapterId: "basics", id: "basics", kind: "chapter", skillId: "a" }),
      item({ id: "c1", skillId: "c" }),
      item({ id: "b1-left", skillId: "b" }),
    ];

    expect(
      order({ items, left: ["b1-left"], prerequisites: new Map([["b", ["a"]]]) }),
    ).toStrictEqual(["basics", "b1-left", "c1"]);
  });

  it("never moves a lesson past a phase challenge, but past other events", () => {
    const items = [
      item({ id: "done", skillId: "a", status: "done" }),
      item({ id: "a1", skillId: "a" }),
      item({ id: "boss", kind: "boss" }),
      item({ id: "b1", skillId: "b" }),
      item({ id: "review", kind: "review" }),
      item({ id: "c1-left", skillId: "c" }),
    ];

    expect(order({ items, left: ["c1-left"] })).toStrictEqual([
      "done",
      "a1",
      "boss",
      "c1-left",
      "review",
      "b1",
    ]);
  });
});
