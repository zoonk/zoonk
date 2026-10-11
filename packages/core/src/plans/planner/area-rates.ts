import { getWrittenTestAreas } from "./graph-areas";
import { type PlanGraph } from "./plan-state";

/**
 * A planned skill as its area's rate reads it: its area, the minutes it takes, what it's worth with
 * the learner's steering (`value`) and without it (`baseValue`), and whether they steered it.
 */
type RatedSkill = {
  area: string;
  baseValue: number;
  focused: boolean;
  minutes: number;
  reduced: boolean;
  value: number;
};

/** An area that is worth nothing right now still gets its turn in the study cycle, last. */
const MIN_AREA_RATE = 1e-6;

/**
 * A written test's protected share of the study cycle, as a part of what an average subject gets:
 * however well the learner already writes, graded writing keeps coming back every week.
 */
const WRITTEN_TEST_MIN_SHARE = 0.5;

function sumChange({
  areas,
  from,
  to,
}: {
  areas: ReadonlySet<string>;
  from: ReadonlyMap<string, number>;
  to: ReadonlyMap<string, number>;
}): number {
  return [...areas].reduce(
    (total, area) => total + Math.max(0, (to.get(area) ?? 0) - (from.get(area) ?? 0)),
    0,
  );
}

/**
 * Each area's rate once the learner gives some areas more time and others less in one change: the
 * time the areas they want less of give up goes to the ones they want more of, up to what more of
 * them alone would give, so every area they didn't name keeps its share of the days. Steered on
 * their own, more of one area took its time from every other one: Rafaela's "more Legislative
 * Process, less Linguistics" left political science and administrative law 43 lessons short. A
 * change that only gives more, or only less, keeps the steered rates (`steered`).
 */
function balanceSteeredRates({
  base,
  skills,
  steered,
}: {
  /** Each area's rate without the learner's steering. */
  base: ReadonlyMap<string, number>;
  skills: readonly RatedSkill[];
  /** Each area's rate with it: more of an area doubles what its skills are worth, less halves it. */
  steered: ReadonlyMap<string, number>;
}): Map<string, number> {
  const focused = new Set(skills.filter((skill) => skill.focused).map((skill) => skill.area));
  const reduced = new Set(skills.filter((skill) => skill.reduced).map((skill) => skill.area));

  const freed = sumChange({ areas: reduced, from: steered, to: base });
  const asked = sumChange({ areas: focused, from: base, to: steered });

  if (freed <= 0 || asked <= 0) {
    return new Map(steered);
  }

  const share = Math.min(1, freed / asked);

  return new Map(
    [...steered].map(([area, rate]) => {
      const was = base.get(area) ?? rate;
      return [area, focused.has(area) ? was + (rate - was) * share : rate];
    }),
  );
}

/**
 * Each area's share of an exam's study days: what its skills are worth on average, minute for
 * minute (the exam's weight on them, the learner's gaps and focus), so time goes where it pays,
 * with a written test kept at no less than its protected share (see `withWrittenTestFloor`), and
 * the time the learner takes from some areas going to the ones they want more of (see
 * `balanceSteeredRates`).
 */
export function getAreaRates({
  graph,
  skills,
}: {
  graph: PlanGraph;
  skills: readonly RatedSkill[];
}): Map<string, number> {
  const written = getWrittenTestAreas(graph);

  const rates = (valueOf: (skill: RatedSkill) => number) =>
    withWrittenTestFloor({ rates: getWorthRates({ skills, valueOf }), written });

  return balanceSteeredRates({
    base: rates((skill) => skill.baseValue),
    skills,
    steered: rates((skill) => skill.value),
  });
}

/**
 * A written test's rate raised to `WRITTEN_TEST_MIN_SHARE` of the other subjects' average: the
 * exam's weight on it times the learner's gap there says how much time it gets, and a learner
 * who already writes well still practices it every week instead of only once the others are done.
 */
function withWrittenTestFloor({
  rates,
  written,
}: {
  rates: ReadonlyMap<string, number>;
  written: ReadonlySet<string>;
}): Map<string, number> {
  const others = [...rates].filter(([area]) => !written.has(area)).map(([, rate]) => rate);

  if (others.length === 0) {
    return new Map(rates);
  }

  const floor =
    (WRITTEN_TEST_MIN_SHARE * others.reduce((sum, rate) => sum + rate, 0)) / others.length;

  return new Map(
    [...rates].map(([area, rate]) => [area, written.has(area) ? Math.max(rate, floor) : rate]),
  );
}

/** Each area's rate from what its skills are worth on average (`valueOf`), minute for minute. */
function getWorthRates({
  skills,
  valueOf,
}: {
  skills: readonly RatedSkill[];
  valueOf: (skill: RatedSkill) => number;
}): Map<string, number> {
  const totals = skills.reduce((areas, skill) => {
    const total = areas.get(skill.area) ?? { minutes: 0, worth: 0 };
    const minutes = Math.max(skill.minutes, 1);

    return areas.set(skill.area, {
      minutes: total.minutes + minutes,
      worth: total.worth + valueOf(skill) * minutes,
    });
  }, new Map<string, { minutes: number; worth: number }>());

  return new Map(
    [...totals].map(([area, total]) => [
      area,
      Math.max(MIN_AREA_RATE, total.worth / total.minutes),
    ]),
  );
}
