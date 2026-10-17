import { describe, expect, it } from "vitest";
import { type DatedEstimate, type UndatedEstimate, hasStudyToShow } from "./plan-estimate";

const WORKLOAD = {
  checkpointMinutes: 0,
  lessonMinutes: 0,
  practiceMinutes: 0,
  unwrittenLessonMinutes: 0,
};

const NUMBERS: DatedEstimate["numbers"] = {
  afterDeadlineMinutes: null,
  availableBeforeDeadlineMinutes: null,
  beforeDeadlineMinutes: null,
  context: {
    dailyMinutes: 15,
    fromDate: "2026-10-14",
    fullCourse: false,
    ownLevel: "none",
    paceFactor: 1,
    targetDate: null,
    weekdayMinutes: [0, 15, 15, 15, 15, 15, 0],
  },
  coverage: null,
  milestoneExtraMinutesBeforeDeadline: null,
  scheduledMinutes: 0,
  studyDaysBeforeDeadline: null,
  workload: WORKLOAD,
};

const PUBLISHED = { lessons: 5, minutes: 20 };

function dated(areas: Partial<DatedEstimate["areas"][number]>[]): DatedEstimate {
  return {
    areas: areas.map((area) => ({
      area: "Math",
      fitting: 0,
      plannedMinutes: 0,
      quickLessons: 0,
      total: 5,
      unwrittenMinutes: 0,
      ...area,
    })),
    chapters: [],
    fittingLessons: areas.reduce((sum, area) => sum + (area.fitting ?? 0), 0),
    numbers: NUMBERS,
    publishedContent: PUBLISHED,
    workload: WORKLOAD,
  };
}

function undated(weeks: number): UndatedEstimate {
  return {
    chapters: [],
    endDate: null,
    firstDay: [],
    numbers: NUMBERS,
    publishedContent: PUBLISHED,
    weeks,
    workload: WORKLOAD,
  };
}

describe(hasStudyToShow, () => {
  it("keeps an exam plan whose course lessons all wait but which studies in quick or unwritten lessons", () => {
    expect(hasStudyToShow(dated([{ plannedMinutes: 7.5, unwrittenMinutes: 7.5 }]))).toBe(true);
    expect(hasStudyToShow(dated([{ plannedMinutes: 12, quickLessons: 3 }]))).toBe(true);
  });

  it("drops an exam plan that studies nothing by the date", () => {
    expect(hasStudyToShow(dated([{ plannedMinutes: 0 }, { area: "Science" }]))).toBe(false);
  });

  it("drops a plan to the course's end that never ends, and keeps one that does", () => {
    expect(hasStudyToShow(undated(0))).toBe(false);
    expect(hasStudyToShow(undated(29))).toBe(true);
  });
});
