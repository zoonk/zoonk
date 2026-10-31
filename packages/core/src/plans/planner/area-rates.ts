import { getWrittenTestAreas } from "./graph-areas";
import { type PlanGraph } from "./plan-state";

type RatedSkill = {
  area: string;
  baseValue: number;
  focused: boolean;
  minutes: number;
  reduced: boolean;
  value: number;
};

/** Above zero, so an area worth nothing now still gets its turn in the study cycle, last. */
const MIN_AREA_RATE = 1e-6;

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

function balanceSteeredRates({
  base,
  skills,
  steered,
}: {
  base: ReadonlyMap<string, number>;
  skills: readonly RatedSkill[];
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
