import { describe, expect, it } from "vitest";
import { getTopicHeadings, groupTopicsByHeading } from "./topic-groups";

const kept = (text: string) => ({ kept: true, text });

describe(groupTopicsByHeading, () => {
  it("puts each topic under the heading before it, leaving the ones above the first heading out", () => {
    expect(
      groupTopicsByHeading({
        headings: [
          { firstTopic: "1 Energia", name: "Física" },
          { firstTopic: "Transformações químicas", name: " Química " },
        ],
        topics: [
          kept("Introdução"),
          kept("1 Energia"),
          kept("2 Calor"),
          { kept: false, text: "Não confirmado" },
          kept("Transformações químicas"),
        ],
      }),
    ).toStrictEqual([
      { name: "Física", topics: ["1 Energia", "2 Calor"] },
      { name: "Química", topics: ["Transformações químicas"] },
    ]);
  });

  it("finds a heading's first topic written otherwise (its number, case, accents)", () => {
    expect(
      groupTopicsByHeading({
        headings: [
          { firstTopic: "energia", name: "Física" },
          { firstTopic: "QUIMICA GERAL", name: "Química" },
        ],
        topics: [kept("1 Energia"), kept("2 Química geral")],
      }),
    ).toStrictEqual([
      { name: "Física", topics: ["1 Energia"] },
      { name: "Química", topics: ["2 Química geral"] },
    ]);
  });

  it("drops headings out of order or whose topics are gone, and groups nothing with one left", () => {
    expect(
      groupTopicsByHeading({
        headings: [
          { firstTopic: "B", name: "Second" },
          { firstTopic: "A", name: "First, listed late" },
          { firstTopic: "C", name: "Gone" },
          { firstTopic: "Missing", name: "Nowhere" },
        ],
        topics: [kept("A"), kept("B"), { kept: false, text: "C" }],
      }),
    ).toStrictEqual([]);
  });
});

describe(getTopicHeadings, () => {
  it("names each topic's heading, and none for a subject without headings", () => {
    expect(
      getTopicHeadings([
        { name: "Física", topics: ["Energia"] },
        { name: "Química", topics: ["Reações"] },
      ]),
    ).toStrictEqual(
      new Map([
        ["Energia", "Física"],
        ["Reações", "Química"],
      ]),
    );

    expect(getTopicHeadings()).toStrictEqual(new Map());
  });
});
