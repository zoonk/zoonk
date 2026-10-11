import { describe, expect, it } from "vitest";
import { estimateSpeakingSection } from "./speaking-estimate";
import { getSpeakingFormat, listTaskCriteria } from "./speaking-formats";

function format(exam: "cambridge" | "dele" | "goethe", level: "B1" | "B2") {
  const found = getSpeakingFormat({ exam, level });

  if (!found) {
    throw new Error(`No ${exam} ${level} format`);
  }

  return found;
}

/** Every criterion a task rates, at one band. */
function gradeAll({
  band,
  format: paper,
  task,
}: {
  band: number;
  format: ReturnType<typeof format>;
  task: string;
}) {
  return {
    criteria: listTaskCriteria({ format: paper, task }).map((criterion) => ({
      bandHigh: band,
      bandLow: band,
      criterion: criterion.key,
    })),
    spokenSeconds: 120,
    task,
  };
}

describe(estimateSpeakingSection, () => {
  it("gives DELE B2's points out of 25: band 2 everywhere is two thirds of them", () => {
    const dele = format("dele", "B2");
    const grades = dele.tasks.map((task) => gradeAll({ band: 2, format: dele, task: task.key }));
    const estimate = estimateSpeakingSection({ format: dele, grades });

    expect(estimate.complete).toBe(true);
    expect(estimate.total).toBe(25);
    expect(estimate.low).toBeCloseTo(16.67, 2);
    expect(estimate.high).toBeCloseTo(16.67, 2);
  });

  it("isn't complete, and gives no points, until every task is graded", () => {
    const dele = format("dele", "B2");

    const estimate = estimateSpeakingSection({
      format: dele,
      grades: [gradeAll({ band: 2, format: dele, task: "t1" })],
    });

    expect(estimate).toMatchObject({ complete: false, high: null, low: null });
  });

  it("adds Goethe B1's lines: band B everywhere is 75 of 100", () => {
    const goethe = format("goethe", "B1");

    const grades = goethe.tasks.map((task) =>
      gradeAll({ band: 3, format: goethe, task: task.key }),
    );

    expect(estimateSpeakingSection({ format: goethe, grades })).toMatchObject({
      complete: true,
      high: 75,
      low: 75,
      total: 100,
    });
  });

  it("counts Cambridge's half bands and weighs Global Achievement as the exam does", () => {
    const cambridge = format("cambridge", "B2");

    const grades = cambridge.tasks.map((task) => {
      const grade = gradeAll({ band: 3, format: cambridge, task: task.key });

      return {
        ...grade,
        criteria: grade.criteria.map((item) =>
          item.criterion === "global" ? { ...item, bandHigh: 4, bandLow: 3.5 } : item,
        ),
      };
    });

    // Four analytic scales at band 3 (x2) and Global Achievement at 3.5 to 4 (x4), out of 60.
    expect(estimateSpeakingSection({ format: cambridge, grades })).toMatchObject({
      complete: true,
      high: 40,
      low: 38,
      total: 60,
    });
  });

  it("rates a whole-paper criterion from every task, weighted by how long each ran", () => {
    const dele = format("dele", "B2");

    const grades = [
      { ...gradeAll({ band: 2, format: dele, task: "t1" }), spokenSeconds: 300 },
      { ...gradeAll({ band: 2, format: dele, task: "t2" }), spokenSeconds: 300 },
      { ...gradeAll({ band: 0, format: dele, task: "t3" }), spokenSeconds: 60 },
    ];

    const estimate = estimateSpeakingSection({ format: dele, grades });
    const holistic = estimate.criteria.find((item) => item.criterion === "holistic");

    // (2 x 300 + 2 x 300 + 0 x 60) / 660 is about 1.8, which the exam's whole bands round to 2.
    expect(holistic).toMatchObject({ bandHigh: 2, bandLow: 2, task: null });
  });
});
