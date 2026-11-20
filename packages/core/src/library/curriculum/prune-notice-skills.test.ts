import { describe, expect, it } from "vitest";
import { findOutsideNoticeSkills } from "./prune-notice-skills";

const subjects = [
  {
    name: "Public Finance",
    shortName: "Finance",
    topics: ["Budget laws"],
    writtenTasks: ["Fiscal opinion"],
  },
];

describe(findOutsideNoticeSkills, () => {
  it("keeps notice skills, scored parts, unknown matched skills and their transitive bases", () => {
    const skills = [
      {
        area: "Public Finance",
        id: "budget",
        prerequisites: ["accounting"],
        topics: ["Budget laws"],
      },
      { area: "Accounting", id: "accounting", prerequisites: ["arithmetic"], topics: [] },
      { area: "Arithmetic", id: "arithmetic", topics: [] },
      { area: "Finance", id: "old" },
      { area: "Fiscal opinion", id: "writing", outcome: true, topics: [] },
      { area: "Public Finance", id: "scores", outcome: true, topics: [] },
      { area: "Public Finance", id: "irrelevant-finance", topics: [] },
      { area: "Strategy", id: "strategy", prerequisites: ["logic"], topics: [] },
      { area: "Logic", id: "logic" },
      { area: "English", id: "english", topics: ["Vocabulary"] },
      { area: "Portuguese", id: "portuguese", topics: [] },
      { area: "Constitutional Law", id: "law", topics: [] },
    ];

    expect(findOutsideNoticeSkills({ skills, subjects })).toStrictEqual([
      "irrelevant-finance",
      "strategy",
      "logic",
      "english",
      "portuguese",
      "law",
    ]);
  });

  it("keeps the whole graph when none of its skills has a notice topic", () => {
    const skills = [
      { area: "Finance", id: "old" },
      { area: "Strategy", id: "strategy", topics: [] },
      { area: "English", id: "english", topics: ["Vocabulary"] },
    ];

    expect(findOutsideNoticeSkills({ skills, subjects })).toStrictEqual([]);
  });

  it("drops known topic-less skills even when every area matches a subject", () => {
    const skills = [
      { area: "Finance", id: "budget", topics: ["Budget laws"] },
      ...Array.from({ length: 4 }, (_, index) => ({
        area: "Finance",
        id: String(index),
        topics: [],
      })),
    ];

    expect(findOutsideNoticeSkills({ skills, subjects })).toStrictEqual(["0", "1", "2", "3"]);
  });
});
