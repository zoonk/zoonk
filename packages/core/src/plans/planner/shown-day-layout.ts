import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type BuildPlanInput } from "./build-plan";
import { type scheduleCarriedAndRest } from "./carried-and-rest";
import { markAfterCarried } from "./carried-schedule";
import { getOneDayStudy, toDayMinutes } from "./interval-study-minutes";
import { toIsoDate } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { type PlanDay, type ScheduledEvent, type ScheduledUnit } from "./schedule-units";
import { type layOutAfterThisWeek } from "./week-after";

type DayLayout = ReturnType<typeof layOutAfterThisWeek<ReturnType<typeof scheduleCarriedAndRest>>>;

type LayoutInput = {
  days: readonly PlanDay[];
  kept?: readonly ExistingPlanItem[];
  units: readonly QueueUnit[];
};

function heldUnits({ layout, today }: { layout: DayLayout; today: Date }): ScheduledUnit[] {
  const label = toIsoDate(today);

  return [...layout.carriedSchedule.units, ...layout.restSchedule.units].flatMap((unit) => {
    if (unit.kind === "boss") {
      return unit.date.getTime() === today.getTime() ? [unit] : [];
    }

    const portions = (unit.studyPortions ?? []).filter(
      (portion) => portion.date === label && portion.lessonMinutes > 0,
    );

    if (portions.length === 0) {
      return [];
    }

    if (unit.lessonId !== null) {
      return [unit];
    }

    const minutes = portions.reduce((total, portion) => total + portion.lessonMinutes, 0);

    return [
      {
        ...unit,
        date: today,
        ...(unit.lessons === undefined ? {} : { lessons: (unit.lessons * minutes) / unit.minutes }),
        minutes,
        studyMinutes: portions.reduce((total, portion) => total + portion.minutes, 0),
        studyPortions: portions,
        teachingEnd: today,
      },
    ];
  });
}

function remainingUnits({
  held,
  units,
}: {
  held: readonly ScheduledUnit[];
  units: readonly QueueUnit[];
}): QueueUnit[] {
  const minutes = new Map<string, number>();

  for (const unit of held) {
    minutes.set(unit.key, (minutes.get(unit.key) ?? 0) + unit.minutes);
  }

  return units.flatMap((unit) => {
    const taken = minutes.get(unit.key) ?? 0;

    if (taken === 0) {
      return [unit];
    }

    if (unit.lessonId !== null || unit.kind === "boss" || taken >= unit.minutes) {
      return [];
    }

    return [
      {
        ...unit,
        minutes: unit.minutes - taken,
        ...(unit.lessons === undefined
          ? {}
          : { lessons: (unit.lessons * (unit.minutes - taken)) / unit.minutes }),
      },
    ];
  });
}

function futureDays({
  days,
  held,
  today,
}: {
  days: readonly PlanDay[];
  held: readonly ScheduledUnit[];
  today: Date;
}) {
  const reserved = new Map<string, number>();

  for (const unit of held) {
    for (const portion of unit.studyPortions ?? []) {
      reserved.set(portion.date, (reserved.get(portion.date) ?? 0) + portion.lessonMinutes);
    }
  }

  return days
    .filter((day) => day.date > today)
    .map((day) => ({
      ...day,
      shape: {
        ...day.shape,
        reserved: (day.shape.reserved ?? 0) + (reserved.get(toIsoDate(day.date)) ?? 0),
      },
    }));
}

type ShownDay = {
  days: readonly PlanDay[];
  events: ScheduledEvent[];
  held: ScheduledUnit[];
  units: readonly QueueUnit[];
};

function holdWholeOn({ day, unit }: { day: PlanDay; unit: QueueUnit }): ScheduledUnit {
  const { share } = day.shape;

  if (unit.kind === "boss") {
    return {
      ...unit,
      date: day.date,
      studyMinutes: toDayMinutes({ lessonMinutes: unit.minutes, share }),
    };
  }

  return {
    ...unit,
    date: day.date,
    phase: day.shape.phase ?? unit.phase,
    ...getOneDayStudy({ date: day.date, lessonMinutes: unit.minutes, share }),
  };
}

/** The rest still fills today's time left after the opened work, so the day before an exam keeps the lessons it can't move; an event the opened day doesn't hold leaves today. */
function holdOpenedDay({
  days,
  input,
  units,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  units: readonly QueueUnit[];
}): ShownDay | null {
  const { openedKeys, today } = input;
  const day = days.find((planDay) => planDay.date.getTime() === today.getTime());

  if (!openedKeys || !day) {
    return null;
  }

  const opened = new Set(openedKeys);
  const byKey = new Map(units.map((unit) => [unit.key, unit]));

  const held = [...opened].flatMap((key) => {
    const unit = byKey.get(key);
    return unit ? [holdWholeOn({ day, unit })] : [];
  });

  // A mock keeps its funded day even when a free learner's session reviews in its place.
  const mocks = new Set(
    input.items.flatMap((item) =>
      item.kind === "mock" && item.scheduledFor?.getTime() === today.getTime()
        ? [getItemKey(item)]
        : [],
    ),
  );

  const shape = {
    ...day.shape,
    events: day.shape.events.filter((event) => opened.has(event.key) || mocks.has(event.key)),
    reserved: (day.shape.reserved ?? 0) + held.reduce((total, unit) => total + unit.minutes, 0),
  };

  return {
    days: days.map((planDay) => (planDay === day ? { ...day, shape } : planDay)),
    events: [],
    held,
    units: units.filter((unit) => !opened.has(unit.key)),
  };
}

function holdShownBefore({
  days,
  input,
  layOutBefore,
  units,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  layOutBefore: (input: { days: readonly PlanDay[]; fresh: ReadonlySet<string> }) => DayLayout;
  units: readonly QueueUnit[];
}): ShownDay | null {
  const known = new Set(input.items.map((item) => getItemKey(item)));

  const fresh = new Set(
    units.flatMap((unit) => (unit.lessonId && !known.has(unit.key) ? [unit.key] : [])),
  );

  const teachesToday = days.some(
    (day) => day.date.getTime() === input.today.getTime() && day.shape.open,
  );

  const available = new Set(input.lessons.map((lesson) => lesson.lessonId));

  const unavailable = input.items.some(
    (item) =>
      item.kind === "lesson" &&
      item.status === "todo" &&
      !available.has(item.lessonId ?? "") &&
      (readSelectedItemFacts(item.facts)?.parts.written ?? 0) > 0,
  );

  if (
    !teachesToday ||
    !input.todayShown ||
    input.mode !== "forced" ||
    known.size === 0 ||
    (fresh.size === 0 && !unavailable)
  ) {
    return null;
  }

  const before = layOutBefore({ days, fresh });

  const held = heldUnits({ layout: before, today: input.today }).filter(
    (unit) => unit.lessonId === null || available.has(unit.lessonId),
  );

  return {
    days: futureDays({ days, held, today: input.today }),
    events: before.restSchedule.events.filter((event) => event.date <= input.today),
    held,
    units: remainingUnits({ held, units }),
  };
}

export function layOutShownDay({
  days,
  input,
  layOut,
  layOutBefore,
  units,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  layOut: (input: LayoutInput) => DayLayout;
  layOutBefore: (input: { days: readonly PlanDay[]; fresh: ReadonlySet<string> }) => DayLayout;
  units: readonly QueueUnit[];
}): DayLayout {
  const shown =
    holdOpenedDay({ days, input, units }) ?? holdShownBefore({ days, input, layOutBefore, units });

  if (!shown) {
    return layOut({ days, units });
  }

  const { events, held } = shown;
  const heldKeys = new Set(held.map((unit) => unit.key));
  const dated = new Map(held.map((unit) => [unit.key, unit.teachingEnd ?? unit.date]));

  const kept = input.items.flatMap((item) =>
    heldKeys.has(getItemKey(item))
      ? [{ ...item, scheduledFor: dated.get(getItemKey(item)) ?? item.scheduledFor }]
      : [],
  );

  const after = layOut({
    days: shown.days,
    kept,
    units: markAfterCarried({ schedule: { units: held }, units: shown.units }),
  });

  return {
    ...after,
    carriedSchedule: { ...after.carriedSchedule, units: [...held, ...after.carriedSchedule.units] },
    restSchedule: { ...after.restSchedule, events: [...events, ...after.restSchedule.events] },
  };
}
