import { describe, expect, it } from "vitest";
import { placeUncoveredMembers } from "./place-list-members";

/** Members 1 to `size`, each taught by the skill `m<number>` when `order` has it. */
function place({ order, size }: { order: string[]; size: number }) {
  const members = Array.from({ length: size }, (_, index) => ({
    item: index + 1,
    skills: [`m${index + 1}`],
  }));

  return placeUncoveredMembers({ members, order });
}

/** The graph's order once each placed member is in it. */
function teach({ order, size }: { order: string[]; size: number }): string[] {
  const placed = place({ order, size });

  return [
    ...placed.filter((member) => member.after === -1).map((member) => `m${member.item}`),
    ...order.flatMap((key, index) => [
      key,
      ...placed.filter((member) => member.after === index).map((member) => `m${member.item}`),
    ]),
  ];
}

describe(placeUncoveredMembers, () => {
  it("puts a gap after the earlier member in a forward graph", () => {
    expect(teach({ order: ["intro", "m1", "m2", "m4", "m5"], size: 5 })).toStrictEqual([
      "intro",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
    ]);
  });

  it("puts a gap after the later member in a graph that teaches the list backward", () => {
    expect(teach({ order: ["m5", "m4", "m2", "m1"], size: 5 })).toStrictEqual([
      "m5",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);
  });

  it("keeps consecutive gaps in teaching order both ways", () => {
    expect(teach({ order: ["m2", "m5"], size: 5 })).toStrictEqual(["m1", "m2", "m3", "m4", "m5"]);
    expect(teach({ order: ["m5", "m2"], size: 5 })).toStrictEqual(["m5", "m4", "m3", "m2", "m1"]);
  });

  it("puts a gap at either end of the list beside its one neighbor, on the graph's side", () => {
    expect(teach({ order: ["intro", "m2", "m3"], size: 4 })).toStrictEqual([
      "intro",
      "m1",
      "m2",
      "m3",
      "m4",
    ]);

    expect(teach({ order: ["intro", "m3", "m2"], size: 4 })).toStrictEqual([
      "intro",
      "m4",
      "m3",
      "m2",
      "m1",
    ]);
  });

  it("reads an end gap's side from the members next to it, past a fixed opening member", () => {
    expect(teach({ order: ["m1", "m6", "m5", "m4", "m3", "m2"], size: 7 })).toStrictEqual([
      "m1",
      "m7",
      "m6",
      "m5",
      "m4",
      "m3",
      "m2",
    ]);

    expect(teach({ order: ["m7", "m2", "m3", "m4", "m5", "m6"], size: 7 })).toStrictEqual([
      "m7",
      "m1",
      "m2",
      "m3",
      "m4",
      "m5",
      "m6",
    ]);
  });

  it("reads an end gap's side past members one skill teaches together", () => {
    const placed = placeUncoveredMembers({
      members: [
        { item: 1, skills: ["m1"] },
        { item: 2, skills: ["m2-3"] },
        { item: 3, skills: ["m2-3"] },
        { item: 4, skills: [] },
      ],
      order: ["m2-3", "m1"],
    });

    expect(placed).toStrictEqual([{ after: -1, item: 4, neighbor: 0 }]);
  });

  it("reads a gap's side past one skill teaching the members on both sides of it", () => {
    const placed = placeUncoveredMembers({
      members: [
        { item: 1, skills: ["m1"] },
        { item: 2, skills: ["m2-5"] },
        { item: 3, skills: [] },
        { item: 4, skills: [] },
        { item: 5, skills: ["m2-5"] },
        { item: 6, skills: ["m6"] },
      ],
      order: ["m6", "m2-5", "m1"],
    });

    expect(placed).toStrictEqual([
      { after: 1, item: 4, neighbor: 1 },
      { after: 1, item: 3, neighbor: 1 },
    ]);
  });

  it("takes the phase and area of the skill it sits beside", () => {
    expect(place({ order: ["intro", "m2", "m3"], size: 4 })).toStrictEqual([
      { after: 0, item: 1, neighbor: 1 },
      { after: 2, item: 4, neighbor: 2 },
    ]);
  });

  it("places a member split across skills after its last part", () => {
    const placed = placeUncoveredMembers({
      members: [
        { item: 1, skills: ["m1-a", "m1-b"] },
        { item: 2, skills: [] },
        { item: 3, skills: ["m3"] },
      ],
      order: ["m1-a", "m1-b", "m3"],
    });

    expect(placed).toStrictEqual([{ after: 1, item: 2, neighbor: 1 }]);
  });

  it("treats a skill the graph doesn't have as teaching nothing", () => {
    const placed = placeUncoveredMembers({
      members: [
        { item: 1, skills: ["m1"] },
        { item: 2, skills: ["made-up"] },
        { item: 3, skills: ["m3"] },
      ],
      order: ["m1", "m3"],
    });

    expect(placed).toStrictEqual([{ after: 0, item: 2, neighbor: 0 }]);
  });

  it("appends every member in the list's order when the graph teaches none", () => {
    expect(place({ order: ["intro", "practice"], size: 2 })).toStrictEqual([
      { after: 1, item: 1, neighbor: 1 },
      { after: 1, item: 2, neighbor: 1 },
    ]);
  });

  it("places nothing when every member is taught", () => {
    expect(place({ order: ["m1", "m2"], size: 2 })).toStrictEqual([]);
  });
});
