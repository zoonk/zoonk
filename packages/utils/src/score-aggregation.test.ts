import { describe, expect, it } from "vitest";
import {
  type ScoredRow,
  aggregateScoreByMonth,
  aggregateScoreByWeek,
  aggregateScoreByYear,
  findBestByScore,
} from "./score-aggregation";

function calcScore(correct: number, incorrect: number) {
  return (correct / (correct + incorrect)) * 100;
}

describe(aggregateScoreByYear, () => {
  it("aggregates correct/incorrect by year and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(2025, 3, 10), incorrect: 2 },
      { correct: 6, date: new Date(2025, 8, 20), incorrect: 4 },
      { correct: 9, date: new Date(2026, 1, 5), incorrect: 1 },
    ];

    const result = aggregateScoreByYear(dataPoints, calcScore);

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // 2025: 8+6=14 correct, 2+4=6 incorrect
      calcScore(9, 1), // 2026: 9 correct, 1 incorrect
    ]);
  });
});

describe(aggregateScoreByWeek, () => {
  it("aggregates correct/incorrect by week and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(2026, 2, 2), incorrect: 2 }, // Monday
      { correct: 6, date: new Date(2026, 2, 3), incorrect: 4 }, // Tuesday (same week)
      { correct: 9, date: new Date(2026, 2, 9), incorrect: 1 }, // Next Monday
    ];

    const result = aggregateScoreByWeek(dataPoints, calcScore);

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // Week 1: 8+6=14 correct, 2+4=6 incorrect
      calcScore(9, 1), // Week 2: 9 correct, 1 incorrect
    ]);
  });
});

describe(aggregateScoreByMonth, () => {
  it("aggregates correct/incorrect by month and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(2026, 0, 5), incorrect: 2 },
      { correct: 6, date: new Date(2026, 0, 20), incorrect: 4 },
      { correct: 9, date: new Date(2026, 1, 10), incorrect: 1 },
    ];

    const result = aggregateScoreByMonth(dataPoints, calcScore);

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // Jan
      calcScore(9, 1), // Feb
    ]);
  });
});

describe(findBestByScore, () => {
  it("finds row with highest score", () => {
    const rows: ScoredRow[] = [
      { correct: 7, incorrect: 3, key: 1 },
      { correct: 9, incorrect: 1, key: 2 },
      { correct: 5, incorrect: 5, key: 3 },
    ];

    const result = findBestByScore(rows);
    expect(result).toEqual({ key: 2, score: 90 });
  });

  it("breaks ties by total", () => {
    const rows: ScoredRow[] = [
      { correct: 8, incorrect: 2, key: 1 }, // 80%, total 10
      { correct: 16, incorrect: 4, key: 2 }, // 80%, total 20
    ];

    const result = findBestByScore(rows);
    expect(result).toEqual({ key: 2, score: 80 });
  });

  it("returns null for empty array", () => {
    expect(findBestByScore([])).toBeNull();
  });

  it("returns null when all rows have zero data", () => {
    const rows: ScoredRow[] = [{ correct: 0, incorrect: 0, key: 1 }];
    expect(findBestByScore(rows)).toBeNull();
  });
});
