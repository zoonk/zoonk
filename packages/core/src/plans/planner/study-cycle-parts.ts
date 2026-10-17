import { type QueueUnit } from "./plan-units";
import { type CycleContext } from "./study-cycle-lanes";

/**
 * A part's units, with whether any of them is a core or in an area the learner didn't reduce:
 * what `startsPart` asks of the part, kept as units join so a real-size exam (thousands of units)
 * doesn't scan the part again for each one.
 */
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

/**
 * Whether a unit starts a new part after the ones before it in its group: the first depth after
 * the cores, and the first depth of an area the learner wants less of after the others' depth.
 */
function startsPart({ last, unit }: { last: Part; unit: QueueUnit }): boolean {
  if (!unit.depth) {
    return false;
  }

  return last.hasCore || (unit.reduced === true && last.hasUnreduced);
}

/**
 * Splits units into the parts arranged one after the other: at the phase checkpoints an exam
 * without a date closes its phases with (the checkpoint closes the phase's last day), and where the
 * skills' depth starts in a plan short on time (see `putCoresFirst`), so every core is placed
 * before any depth, and the depth of the areas the learner wants less of after every other area's.
 * The deadline then cuts that depth first: in one part, the cycle shares the days by what each
 * area is worth, so an area that ends early anyway kept all of its depth while the others lost
 * theirs (Rafaela's "less Linguistics" took 43 lessons from political science and administrative law).
 */
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

/**
 * The part each skill's core starts in: what builds on a skill needs only its core (see
 * `countBySkill`), so a base whose core is placed already, or whose depth alone is left, holds
 * nothing back.
 */
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

/**
 * One pass of `splitWaiting` with the skills known to wait so far: a lesson waits when its subject
 * already waits in this part, its skill waits, or a skill it builds on waits or starts later.
 * Returns the skills that wait after it: the known ones and those whose core waits without having
 * started (`left`: the core lessons each skill has still to place).
 */
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

/**
 * A part's lessons, less the ones that wait for a later part (`waiting`): from the first lesson of
 * a subject whose skill builds on a skill whose core only a later part starts (`startsIn`), or on
 * a skill that waits itself, the rest of that subject, in order. Taken in this part, nothing could
 * go before it, so it went in anyway, before its base started (R16, Câmara seed 1101: "past
 * basics" on the discursive test brought its essays ahead of the political science they build
 * on). The queue may put a skill before its base in another subject, so the split repeats until
 * the skills that wait settle.
 */
export function splitWaiting({
  context,
  index,
  left,
  lessons,
  startsIn,
}: {
  context: CycleContext;
  /** The part being arranged. */
  index: number;
  /** The core lessons each skill has still to place, after the parts before. */
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
