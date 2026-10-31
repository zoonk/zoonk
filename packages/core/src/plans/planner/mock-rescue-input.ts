import { type BuildPlanInput } from "./build-plan";
import { getExamMockDays, listTakenMockDays } from "./mock-days";
import { getWeeklyEventWeekday, toIsoDate } from "./plan-calendar";
import { getKeptExamWindows } from "./plan-phases";
import { getCalendar, getPlanStart } from "./plan-run-days";

export function getMissedMockRescueDays(input: BuildPlanInput): string[] {
  const targetDate = input.goal?.targetDate;

  if (input.goal?.kind !== "exam" || !targetDate || !input.settings) {
    return [];
  }

  const calendar = getCalendar(input);
  const today = input.today ?? getPlanStart(input);

  const windows = getKeptExamWindows({
    planStart: getPlanStart(input),
    shown: input.examWindows ?? [],
    targetDate,
    today,
  });

  return getExamMockDays({
    calendar,
    eventWeekday: getWeeklyEventWeekday(calendar),
    from: today,
    fullMockMinutes: input.fullMockMinutes ?? input.mockMinutes,
    mockMinutes: input.mockMinutes,
    shortMockMinutes: input.settings.shortMockMinutes,
    takenMocks: listTakenMockDays(input.items ?? []),
    targetDate,
    windows,
  }).ownMockDays.map(toIsoDate);
}
