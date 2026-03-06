import { describe, expect, it } from "vitest";
import {
  type ScoredRow,
  aggregateByPeriod,
  aggregateScoreByPeriod,
  findBestByScore,
} from "./aggregation";

describe("aggregateByPeriod - week", () => {
  const dataPoints = [
    { date: new Date(Date.UTC(2026, 2, 2)), value: 10 }, // Monday
    { date: new Date(Date.UTC(2026, 2, 3)), value: 20 }, // Tuesday (same week)
    { date: new Date(Date.UTC(2026, 2, 9)), value: 30 }, // Next Monday (different week)
  ];

  it("aggregates by sum", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "sum", "week");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // 10+20, 30
  });

  it("aggregates by average", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "average", "week");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // (10+20)/2, 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByPeriod(reversed, (point) => point.value, "sum", "week");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
  });
});

describe("aggregateByPeriod - month", () => {
  const dataPoints = [
    { date: new Date(Date.UTC(2026, 0, 5)), value: 10 },
    { date: new Date(Date.UTC(2026, 0, 20)), value: 20 },
    { date: new Date(Date.UTC(2026, 1, 10)), value: 30 },
  ];

  it("aggregates by sum", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "sum", "month");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // Jan: 10+20, Feb: 30
  });

  it("aggregates by average", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "average", "month");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // Jan: (10+20)/2, Feb: 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByPeriod(reversed, (point) => point.value, "sum", "month");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
  });
});

describe("aggregateByPeriod - year", () => {
  const dataPoints = [
    { date: new Date(Date.UTC(2025, 3, 10)), value: 10 },
    { date: new Date(Date.UTC(2025, 8, 20)), value: 20 },
    { date: new Date(Date.UTC(2026, 1, 5)), value: 30 },
  ];

  it("aggregates by sum", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "sum", "year");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // 2025: 10+20, 2026: 30
  });

  it("aggregates by average", () => {
    const result = aggregateByPeriod(dataPoints, (point) => point.value, "average", "year");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // 2025: (10+20)/2, 2026: 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByPeriod(reversed, (point) => point.value, "sum", "year");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
  });
});

function calcScore(correct: number, incorrect: number) {
  return (correct / (correct + incorrect)) * 100;
}

describe("aggregateScoreByPeriod - year", () => {
  it("aggregates correct/incorrect by year and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(Date.UTC(2025, 3, 10)), incorrect: 2 },
      { correct: 6, date: new Date(Date.UTC(2025, 8, 20)), incorrect: 4 },
      { correct: 9, date: new Date(Date.UTC(2026, 1, 5)), incorrect: 1 },
    ];

    const result = aggregateScoreByPeriod(dataPoints, calcScore, "year");

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // 2025: 8+6=14 correct, 2+4=6 incorrect
      calcScore(9, 1), // 2026: 9 correct, 1 incorrect
    ]);
  });
});

describe("aggregateScoreByPeriod - week", () => {
  it("aggregates correct/incorrect by week and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(Date.UTC(2026, 2, 2)), incorrect: 2 }, // Monday
      { correct: 6, date: new Date(Date.UTC(2026, 2, 3)), incorrect: 4 }, // Tuesday (same week)
      { correct: 9, date: new Date(Date.UTC(2026, 2, 9)), incorrect: 1 }, // Next Monday
    ];

    const result = aggregateScoreByPeriod(dataPoints, calcScore, "week");

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // Week 1: 8+6=14 correct, 2+4=6 incorrect
      calcScore(9, 1), // Week 2: 9 correct, 1 incorrect
    ]);
  });
});

describe("aggregateScoreByPeriod - month", () => {
  it("aggregates correct/incorrect by month and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(Date.UTC(2026, 0, 5)), incorrect: 2 },
      { correct: 6, date: new Date(Date.UTC(2026, 0, 20)), incorrect: 4 },
      { correct: 9, date: new Date(Date.UTC(2026, 1, 10)), incorrect: 1 },
    ];

    const result = aggregateScoreByPeriod(dataPoints, calcScore, "month");

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
