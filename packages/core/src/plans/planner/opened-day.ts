import { readSelectedItemFacts } from "../_utils/selected-item-contract";
import { type BuildPlanInput } from "./build-plan";
import { getSkillArea } from "./graph-areas";
import { getOneDayStudy, toDayMinutes } from "./interval-study-minutes";
import { getItemKey } from "./plan-items";
import { DEFAULT_LESSON_MINUTES, type QueueUnit } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";
import {
  type FixedEvent,
  type PlanDay,
  type ScheduledEvent,
  type ScheduledUnit,
} from "./schedule-units";

export type ShownDay = {
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

/** The opened session already teaches this lesson, so a re-plan whose queue no longer picks it keeps it from the saved plan. */
function toSavedLessonUnit({
  input,
  key,
}: {
  input: BuildPlanInput;
  key: string;
}): QueueUnit | null {
  const item = input.items.find(
    (entry) =>
      entry.kind === "lesson" &&
      entry.status === "todo" &&
      entry.lessonId !== null &&
      getItemKey(entry) === key,
  );

  if (!item?.lessonId) {
    return null;
  }

  const lessonId = item.lessonId;
  const lesson = input.lessons.find((entry) => entry.lessonId === lessonId);
  const skill = input.graph.skills.find((entry) => entry.skillId === item.skillId);
  const written = readSelectedItemFacts(item.facts)?.parts.written;

  return {
    area: skill
      ? getSkillArea({ graph: input.graph, skill })
      : (input.graph.phases[item.phase]?.name ?? ""),
    chapterId: item.chapterId,
    key,
    kind: "lesson",
    lessonId,
    minutes: lesson
      ? lesson.minutes * input.paceFactor
      : written || DEFAULT_LESSON_MINUTES * input.paceFactor,
    phase: item.phase,
    skillId: item.skillId,
    title: lesson?.title ?? item.titleSnapshot,
  };
}

/** The opened session is all of today, as Today shows it: the rest starts tomorrow, and an event the opened day doesn't hold leaves today. */
export function holdOpenedDay({
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
    const unit = byKey.get(key) ?? toSavedLessonUnit({ input, key });
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

  const events = day.shape.events.filter((event) => opened.has(event.key) || mocks.has(event.key));
  const eventKeys = new Set(events.map((event) => event.key));

  const reviews: FixedEvent[] = input.items.flatMap((item) =>
    item.kind === "review" && opened.has(getItemKey(item)) && !eventKeys.has(getItemKey(item))
      ? [
          {
            key: getItemKey(item),
            kind: "review",
            minutes: readSelectedItemFacts(item.facts)?.minutes ?? day.shape.minutes,
            replacesDay: false,
            title: item.titleSnapshot,
          },
        ]
      : [],
  );

  const shape = {
    ...day.shape,
    events: [...events, ...reviews],
    reserved: day.shape.minutes * day.shape.share,
  };

  return {
    days: days.map((planDay) => (planDay === day ? { ...day, shape } : planDay)),
    events: [],
    held,
    units: withoutRepeatedTitles({
      kept: input.items.filter((item) => opened.has(getItemKey(item))),
      units: units.filter((unit) => !opened.has(unit.key)),
    }),
  };
}
