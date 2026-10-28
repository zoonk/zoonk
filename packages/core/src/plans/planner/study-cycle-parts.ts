import { type QueueUnit } from "./plan-units";
import { type CycleContext } from "./study-cycle-lanes";

type Part = { hasCore: boolean; hasUnreduced: boolean; units: QueueUnit[] };

function createPart(units: QueueUnit[] = []): Part {
  return {
    hasCore: units.some((unit) => !unit.depth),
    hasUnreduced: units.some((unit) => !unit.reduced),
    units,
  };
}

function addToPart({ part, unit }: { part: Part; unit: QueueUnit }): void {
  part.units.push(unit);
  part.hasCore ||= !unit.depth;
  part.hasUnreduced ||= !unit.reduced;
}

function startsPart({ last, unit }: { last: Part; unit: QueueUnit }): boolean {
  if (!unit.depth) {
    return false;
  }

  return last.hasCore || (unit.reduced === true && last.hasUnreduced);
}

export function splitIntoParts(units: readonly QueueUnit[]): QueueUnit[][] {
  const parts = units.reduce<Part[]>(
    (groups, unit) => {
      const last = groups.at(-1) ?? createPart();

      if (unit.kind === "boss") {
        return [...groups.slice(0, -1), createPart([...last.units, unit]), createPart()];
      }

      if (startsPart({ last, unit })) {
        groups.push(createPart([unit]));
        return groups;
      }

      addToPart({ part: last, unit });
      return groups.length === 0 ? [last] : groups;
    },
    [createPart()],
  );

  return parts.map((part) => part.units);
}

export function listStartingParts(parts: readonly (readonly QueueUnit[])[]): Map<string, number> {
  return parts.reduce((starts, part, index) => {
    part.forEach((unit) => {
      if (unit.skillId && !unit.depth && !starts.has(unit.skillId)) {
        starts.set(unit.skillId, index);
      }
    });

    return starts;
  }, new Map<string, number>());
}

type Split = { now: QueueUnit[]; waiting: QueueUnit[] };

function splitOnce({
  context,
  index,
  left,
  lessons,
  startsIn,
  waitingSkills,
}: {
  context: CycleContext;
  index: number;
  left: ReadonlyMap<string, number>;
  lessons: readonly QueueUnit[];
  startsIn: ReadonlyMap<string, number>;
  waitingSkills: ReadonlySet<string>;
}): Split & { waitingSkills: Set<string> } {
  const waitingAreas = new Set<string>();
  const startedSkills = new Set<string>();
  const waitsNow = new Set(waitingSkills);

  const isWaiting = (id: string) => waitingSkills.has(id) || (startsIn.get(id) ?? index) > index;

  const waits = (unit: QueueUnit) =>
    waitingAreas.has(unit.area) ||
    waitingSkills.has(unit.skillId ?? "") ||
    (context.prerequisites.get(unit.skillId ?? "") ?? []).some(
      (id) => id !== unit.skillId && isWaiting(id),
    );

  const split = lessons.reduce<Split>(
    (parts, unit) => {
      if (waits(unit)) {
        waitingAreas.add(unit.area);
        parts.waiting.push(unit);
      } else {
        parts.now.push(unit);
        startedSkills.add(unit.skillId ?? "");
      }

      return parts;
    },
    { now: [], waiting: [] },
  );

  split.waiting.forEach(({ depth, skillId }) => {
    if (
      skillId &&
      !depth &&
      !startedSkills.has(skillId) &&
      left.get(skillId) === context.counts.get(skillId)
    ) {
      waitsNow.add(skillId);
    }
  });

  return { ...split, waitingSkills: waitsNow };
}

export function splitWaiting({
  context,
  index,
  left,
  lessons,
  startsIn,
}: {
  context: CycleContext;
  index: number;
  left: ReadonlyMap<string, number>;
  lessons: readonly QueueUnit[];
  startsIn: ReadonlyMap<string, number>;
}): Split {
  let waitingSkills: ReadonlySet<string> = new Set();

  for (;;) {
    const split = splitOnce({ context, index, left, lessons, startsIn, waitingSkills });

    if (split.waitingSkills.size === waitingSkills.size) {
      return { now: split.now, waiting: split.waiting };
    }

    waitingSkills = split.waitingSkills;
  }
}
