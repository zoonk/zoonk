import { describe, expect, it } from "vitest";
import { getPlanTopics, getStudyCounts } from "./study-counts";

const COVERAGE = { studiedSkills: 28, totalSkills: 142 };

describe(getStudyCounts, () => {
  it("counts the lessons studied apart from the ones the learner already knew", () => {
    expect(
      getStudyCounts({ coverage: COVERAGE, lessons: { done: 45, known: 41, total: 1292 } }),
    ).toStrictEqual([
      { done: 4, kind: "studied", total: 1292, unit: "lessons" },
      { done: 41, kind: "known", total: 1292, unit: "lessons" },
    ]);
  });

  it("leaves out what the learner already knew when there's none", () => {
    expect(
      getStudyCounts({ coverage: COVERAGE, lessons: { done: 3, known: 0, total: 20 } }),
    ).toStrictEqual([{ done: 3, kind: "studied", total: 20, unit: "lessons" }]);
  });

  it("counts an exam's own topics, as its Plan does, over the skills behind them", () => {
    expect(
      getStudyCounts({ coverage: COVERAGE, topics: { known: 2, studied: 5, total: 46 } }),
    ).toStrictEqual([
      { done: 5, kind: "studied", total: 46, unit: "topics" },
      { done: 2, kind: "known", total: 46, unit: "topics" },
    ]);
  });

  it("counts what was studied when the plan doesn't say which lessons teach which topic", () => {
    expect(getStudyCounts({ coverage: COVERAGE })).toStrictEqual([
      { done: 28, kind: "studied", total: 142, unit: "topics" },
    ]);
  });
});

function subject(topics: number, studied: number | null, known: number | null) {
  return {
    topics: Array.from({ length: topics }, () => ({})),
    topicsKnown: known,
    topicsStudied: studied,
  };
}

describe(getPlanTopics, () => {
  it("adds up the subjects' topics the way the Plan counts them", () => {
    expect(
      getPlanTopics({
        subjects: [subject(12, 0, 1), subject(34, 3, 0)],
        topicCount: 46,
        topicsMapped: true,
      }),
    ).toStrictEqual({ known: 1, studied: 3, total: 46 });
  });

  it("has no topic count for a plan that doesn't map its topics or has none", () => {
    expect(
      getPlanTopics({ subjects: [subject(12, null, null)], topicCount: 12, topicsMapped: false }),
    ).toBeNull();

    expect(getPlanTopics({ subjects: [], topicCount: 0, topicsMapped: true })).toBeNull();
  });
});
