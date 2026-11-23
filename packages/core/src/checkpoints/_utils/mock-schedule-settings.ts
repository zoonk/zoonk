import { loadWeeklyOutline } from "../../exams/mocks/_utils/plan-weekly-mock";
import { readScheduledStructure } from "../../exams/mocks/_utils/read-mock-structure";
import { toIsoDate } from "../../plans/planner/plan-calendar";
import { type PlanSettings } from "../../plans/planner/plan-state";
import { type OwnedChallenge } from "./owned-challenge";

type Source = { challenge: OwnedChallenge; date: Date; settings: PlanSettings };

async function loadOriginalOutline({ challenge, date, settings }: Source) {
  const structure = readScheduledStructure({
    blueprint: challenge.goal.examBlueprint,
    date,
    goal: challenge.goal,
    settings,
  });

  const { outline } = await loadWeeklyOutline({
    goal: challenge.goal,
    structure,
    today: date,
    userId: challenge.userId,
  });

  return outline;
}

export async function rescheduleMock({
  challenge,
  date,
  settings,
  to,
}: Source & { to: string | null }) {
  const from = toIsoDate(date);
  const funding = settings.mockFunding.find((entry) => entry.date === from);
  const previous = settings.mockSchedule?.find((entry) => entry.to === from);

  const outline =
    funding?.day !== undefined && funding.fullLength !== undefined
      ? funding
      : await loadOriginalOutline({ challenge, date, settings });

  const minutes = funding?.minutes ?? challenge.item.minutes ?? outline.minutes;

  const entry = {
    from: previous?.from ?? from,
    fullLength: outline.fullLength ?? false,
    minutes,
    to,
  };

  const relocated = to
    ? [
        {
          ...funding,
          contributions: funding?.contributions ?? [],
          date: to,
          day: outline.day,
          fullLength: entry.fullLength,
          minutes,
        },
      ]
    : [];

  return {
    ...settings,
    mockFunding: [...settings.mockFunding.filter((saved) => saved.date !== from), ...relocated],
    mockSchedule: [...(settings.mockSchedule ?? []).filter((saved) => saved !== previous), entry],
  };
}
