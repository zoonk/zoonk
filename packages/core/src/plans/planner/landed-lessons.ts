import { type BuildPlanInput } from "./build-plan";
import { getSkillArea } from "./graph-areas";
import { daysBetween } from "./plan-calendar";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { isExamSchedule } from "./plan-queue";
import { type QueueUnit } from "./plan-units";
import {
  type DayShape,
  type PlanDay,
  type ScheduledUnit,
  getLessonCapacity,
  listPlanDays,
  scheduleUnits,
} from "./schedule-units";

/**
 * This week's days an automatic run keeps, from today to its last kept item, with the time their
 * kept items take: what's left is the time of the stand-ins whose lessons were outlined since.
 * Days past the week's last kept item aren't any stand-in's time, so lessons never land there
 * after the ones that come after them.
 */
function listKeptWeek({
  describeDay,
  frozen,
  input,
  units,
}: {
  describeDay: (date: Date) => DayShape;
  frozen: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  units: ReadonlyMap<string, QueueUnit>;
}): PlanDay[] {
  const last = Math.max(...frozen.map((item) => item.scheduledFor?.getTime() ?? 0));

  const horizonDays =
    last >= input.today.getTime() ? daysBetween(input.today, new Date(last)) + 1 : 0;

  const days = listPlanDays({ describeDay, horizonDays, start: input.today });

  return days.map((day) => {
    const kept = frozen
      .filter((item) => item.scheduledFor?.getTime() === day.date.getTime())
      .reduce((total, item) => total + (units.get(getItemKey(item))?.minutes ?? 0), 0);

    return { ...day, shape: { ...day.shape, reserved: Math.min(kept, getLessonCapacity(day)) } };
  });
}

/**
 * The last day a landed stand-in's lessons may take this week: the day of the next kept item that
 * comes after it in the plan (in an exam's study cycle, the next of its subject), so they never
 * land after what follows them; the week's last kept day when nothing does.
 */
function getStandInEnd({
  areaOf,
  frozen,
  standIn,
}: {
  /** Each skill's subject in an exam's study cycle; null for plans taught in order. */
  areaOf: ReadonlyMap<string, string> | null;
  frozen: readonly ExistingPlanItem[];
  standIn: ExistingPlanItem;
}): Date | null {
  const area = areaOf?.get(standIn.skillId ?? "");

  const next = frozen.find(
    (item) =>
      item.position > standIn.position &&
      item.scheduledFor !== null &&
      (!areaOf || areaOf.get(item.skillId ?? "") === area),
  );

  return next?.scheduledFor ?? frozen.findLast((item) => item.scheduledFor)?.scheduledFor ?? null;
}

/**
 * An automatic run keeps this week as it is, except stand-ins whose lessons the Library outlined
 * since: those lessons go in their stand-ins' time this week, in plan order, without moving
 * anything else. A skill's lessons beyond its stand-in's time join its last day there, as a day's
 * own lessons do: what that day doesn't fit comes first the day after (see `carryOver`). A day
 * the learner was already shown (`shownUntil`) only takes what fits its stand-ins' time: its
 * session holds what Today showed and that time, so the rest goes on the days after, and the next
 * day doesn't open by catching up on lessons the learner never saw.
 */
function placeLandedLessons({
  areaOf,
  days,
  frozen,
  pending,
  shownUntil,
  standIns,
}: {
  areaOf: ReadonlyMap<string, string> | null;
  days: readonly PlanDay[];
  frozen: readonly ExistingPlanItem[];
  pending: readonly QueueUnit[];
  /** The last day whose session the learner was shown; null when none was built. */
  shownUntil: Date | null;
  /** The landed stand-ins of this week. */
  standIns: readonly ExistingPlanItem[];
}): ScheduledUnit[] {
  const ends = new Map(
    standIns.map((item) => [
      item.skillId ?? "",
      getStandInEnd({ areaOf, frozen, standIn: item }) ?? item.scheduledFor,
    ]),
  );

  const landed = pending.filter(
    (unit) => unit.kind === "lesson" && unit.lessonId !== null && ends.has(unit.skillId ?? ""),
  );

  if (landed.length === 0 || days.length === 0) {
    return [];
  }

  const placed = new Map(
    scheduleUnits({ days, units: landed }).units.map((unit) => [unit.key, unit.date]),
  );

  const shareOn = (date: Date) =>
    days.find((day) => day.date.getTime() === date.getTime())?.shape.share || 1;

  const isShown = (date: Date) => shownUntil !== null && date <= shownUntil;

  return landed.reduce<ScheduledUnit[]>((scheduled, unit) => {
    const skillId = unit.skillId ?? "";
    const end = ends.get(skillId) ?? days[0]?.date ?? new Date(0);
    const due = placed.get(unit.key);
    const previous = scheduled.findLast((other) => other.skillId === skillId)?.date;
    const fitted = due && (due <= end || isShown(end)) ? due : end;
    const date = previous && previous > fitted ? previous : fitted;

    // Nothing this week fits it but a day already shown: it's planned with the rest, after.
    if (!due && isShown(date)) {
      return scheduled;
    }

    scheduled.push({ ...unit, date, studyMinutes: unit.minutes / shareOn(date) });
    return scheduled;
  }, []);
}

/**
 * The lessons outlined since for this week's stand-ins, in their stand-ins' time (see
 * `placeLandedLessons`): only an automatic run that keeps this week (`start` after today) has
 * any.
 */
export function placeLandedThisWeek({
  describeDay,
  frozen,
  input,
  pending,
  standIns,
  start,
  units,
}: {
  describeDay: (date: Date) => DayShape;
  frozen: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  pending: readonly QueueUnit[];
  standIns: readonly ExistingPlanItem[];
  start: Date;
  units: ReadonlyMap<string, QueueUnit>;
}): ScheduledUnit[] {
  if (start <= input.today) {
    return [];
  }

  const areaOf = isExamSchedule(input.goal)
    ? new Map(
        input.graph.skills.map((skill) => [
          skill.skillId,
          getSkillArea({ graph: input.graph, skill }),
        ]),
      )
    : null;

  return placeLandedLessons({
    areaOf,
    days: listKeptWeek({ describeDay, frozen, input, units }),
    frozen,
    pending,
    shownUntil: input.todayShown ? input.today : null,
    standIns,
  });
}
