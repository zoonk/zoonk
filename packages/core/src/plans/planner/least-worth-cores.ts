import { type QueueUnit } from "./plan-units";
import { type ScoredTopic } from "./topic-weights";

/**
 * A skill's core in the plan: its minutes, where it first comes in teaching order, and whether it
 * holds a lesson on what the class test announces.
 */
type CoreSkill = {
  announced: boolean;
  area: string;
  minutes: number;
  position: number;
  skillId: string;
};

/**
 * What a choice of cores to keep reads: what each skill builds on, the notice topics it teaches
 * with how often the exam asks them, and what it's worth on its own.
 */
type Worth = {
  /**
   * The skills the learner focused on: among topics the exam asks as often, theirs stay first. A
   * focus never keeps a topic asked less in place of one asked more ("more biology" keeps
   * physics' frequent topics); it gives its part the depth and the time instead.
   */
  focused: ReadonlySet<string>;
  /**
   * The skills the learner's last test answer missed: a gap stays before a topic nobody asked them
   * about, however often the exam asks either (see `getPriority`).
   */
  gaps: ReadonlySet<string>;
  /**
   * The skills the learner showed they know (recalled, and not missed since): a plan short on time
   * cuts them before anything they don't know yet, however often the exam asks them. Pedro's class
   * test cut the membrane, which placement found missing, and kept prokaryotes, which he got right.
   */
  known: ReadonlySet<string>;
  /**
   * The part of its subject each skill is in, where the notice groups the subject's topics (ENEM's
   * Física, Química and Biologia): a plan short on time keeps every part's most asked topic, so a
   * whole part never leaves the plan (see `rankCores`).
   */
  parts: ReadonlyMap<string, string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  values: ReadonlyMap<string, number>;
};

/** A core lesson the plan may leave out: an outcome's core never is (see `makeRoomForOutcomes`). */
function isCutCore(unit: QueueUnit): unit is QueueUnit & { skillId: string } {
  return unit.kind === "lesson" && unit.skillId !== null && !unit.depth && !unit.outcome;
}

/** Each skill's core, in the order the plan's units first reach it. */
function listCoreSkills(units: readonly QueueUnit[]): CoreSkill[] {
  return [
    ...units
      .reduce((skills, unit, position) => {
        if (!isCutCore(unit)) {
          return skills;
        }

        const known = skills.get(unit.skillId);

        return skills.set(unit.skillId, {
          announced: Boolean(known?.announced || unit.announced),
          area: unit.area,
          minutes: (known?.minutes ?? 0) + unit.minutes,
          position: known?.position ?? position,
          skillId: unit.skillId,
        });
      }, new Map<string, CoreSkill>())
      .values(),
  ];
}

/** Each area's core minutes that didn't fit before the deadline. */
function sumMissingCores(dropped: readonly QueueUnit[]): Map<string, number> {
  return dropped
    .filter((unit) => isCutCore(unit))
    .reduce(
      (areas, unit) => areas.set(unit.area, (areas.get(unit.area) ?? 0) + unit.minutes),
      new Map<string, number>(),
    );
}

/** A skill with the skills of its area it builds on, directly or not, that aren't kept yet. */
function listWithPrerequisites({
  byId,
  kept,
  prerequisites,
  skillId,
}: {
  byId: ReadonlyMap<string, CoreSkill>;
  kept: ReadonlySet<string>;
  prerequisites: Worth["prerequisites"];
  skillId: string;
}): CoreSkill[] {
  const walk = (id: string, seen: Set<string>): Set<string> => {
    if (seen.has(id) || kept.has(id) || !byId.has(id)) {
      return seen;
    }

    seen.add(id);
    (prerequisites.get(id) ?? []).forEach((required) => walk(required, seen));
    return seen;
  };

  return [...walk(skillId, new Set())].flatMap((id) => byId.get(id) ?? []);
}

/**
 * A skill's cost to keep, with what it builds on: the notice topics it brings into the plan
 * (scored by how often they're asked), the most asked of them, and what it's worth.
 */
type Candidate = {
  /** It brings in a lesson on what the class test announces. */
  announced: boolean;
  /** It brings in a topic of the part of the subject the learner focused on. */
  focused: boolean;
  /** It brings in a skill the learner's last test missed. */
  gap: boolean;
  /** Every skill it brings in is one the learner showed they know. */
  known: boolean;
  /** How often the exam asks the most asked topic it brings in; 0 when it brings none. */
  level: number;
  /** How many of the topics it brings in are asked that often. */
  atLevel: number;
  minutes: number;
  /** How many cores its part of the subject keeps already; 0 for a skill outside every part. */
  partKept: number;
  position: number;
  skills: CoreSkill[];
  topics: number;
  value: number;
};

function toCandidate({
  byId,
  covered,
  kept,
  skill,
  worth,
}: {
  byId: ReadonlyMap<string, CoreSkill>;
  /** The topics the cores kept before it already bring into the plan. */
  covered: ReadonlySet<string>;
  /** The cores kept before it: what it builds on among them costs nothing more. */
  kept: ReadonlySet<string>;
  skill: CoreSkill;
  worth: Worth;
}): Candidate {
  const skills = listWithPrerequisites({
    byId,
    kept,
    prerequisites: worth.prerequisites,
    skillId: skill.skillId,
  });

  const fresh = skills.flatMap((item) =>
    (worth.topics.get(item.skillId) ?? [])
      .filter((topic) => !covered.has(topic.key))
      .map((topic) => ({ ...topic, focused: worth.focused.has(item.skillId) })),
  );

  // A topic counts once, as much as the skill that brings it in most.
  const topics = fresh.reduce(
    (best, topic) => best.set(topic.key, Math.max(best.get(topic.key) ?? 0, topic.score)),
    new Map<string, number>(),
  );

  const level = Math.max(0, ...topics.values());
  const part = worth.parts.get(skill.skillId);

  return {
    announced: skills.some((item) => item.announced),
    atLevel: [...topics.values()].filter((score) => score === level).length,
    focused: fresh.some((topic) => topic.focused),
    gap: skills.some((item) => worth.gaps.has(item.skillId)),
    known: skills.every((item) => worth.known.has(item.skillId)),
    level,
    minutes: skills.reduce((sum, item) => sum + item.minutes, 0),
    partKept: part ? [...kept].filter((id) => worth.parts.get(id) === part).length : 0,
    position: skill.position,
    skills,
    topics: [...topics.values()].reduce((sum, score) => sum + score, 0),
    value: skills.reduce((sum, item) => sum + (worth.values.get(item.skillId) ?? 0), 0),
  };
}

/** Above every topic level (0 to 3): what the learner doesn't know yet ranks over what they do. */
const NOT_KNOWN_PRIORITY = 4;

/** Above anything untested at any level (up to 3 above `NOT_KNOWN_PRIORITY`): a miss. */
const GAP_PRIORITY = 2 * NOT_KNOWN_PRIORITY;

/**
 * Where a candidate's cut ranks: what the learner's last test missed first, however often the exam
 * asks it (another skill may bring its topic in already, which says nothing of what they missed);
 * then what nobody asked them about before what they showed they know, each by how often the exam
 * asks the most asked topic it brings in. Pedro's class test kept the lesson on viruses, which he
 * answered right, and cut the osmosis lesson, his miss.
 */
function getPriority(candidate: Candidate): number {
  if (candidate.gap) {
    return GAP_PRIORITY;
  }

  return (candidate.known ? 0 : NOT_KNOWN_PRIORITY) + candidate.level;
}

/**
 * What the learner's last test missed first, then what they don't know yet, so a gap never waits
 * while what nobody asked about or they showed they know stays; then the most asked topic it
 * brings in, so a topic asked often never waits while one asked less (or unranked, which counts as
 * the middle) stays; among topics asked alike, a lesson on what the class test announces, then the
 * part the learner focused on, then a gap their last test found; then the topics asked that often it
 * brings in per minute, so the cheapest way to each frequent topic comes before one that also
 * brings in what's asked less (a prerequisite's topic); then all the topics it brings in per
 * minute; then what it's worth per minute; then the part of the subject that keeps the fewest
 * cores, so what nothing tells apart is spread over the subject's parts instead of cut from the end
 * of the notice; then earlier in teaching order.
 */
function compareCandidates(a: Candidate, b: Candidate): number {
  const perMinute = (candidate: Candidate, gain: number) => gain / Math.max(candidate.minutes, 1);

  return (
    getPriority(b) - getPriority(a) ||
    Number(b.announced) - Number(a.announced) ||
    Number(b.focused) - Number(a.focused) ||
    Number(b.gap) - Number(a.gap) ||
    perMinute(b, b.atLevel) - perMinute(a, a.atLevel) ||
    perMinute(b, b.topics) - perMinute(a, a.topics) ||
    perMinute(b, b.value) - perMinute(a, a.value) ||
    a.partKept - b.partKept ||
    a.position - b.position
  );
}

/**
 * An area's cores in the order the plan keeps them (see `compareCandidates`), each with the
 * skills of its area it builds on (they cost their minutes too), and the ones that fit in
 * `budget`. First, each part of the subject the plan has nothing of yet (`coveredParts`) keeps its
 * best core while it fits, the parts whose best ranks first first: ENEM's biology, whose most
 * asked topic builds on cells, was left out whole for physics' and chemistry's cheaper frequent
 * topics. Then a core that doesn't fit is skipped, and so is everything that ranks below it from
 * then on (asked less, or what the learner showed they know), even when it would fit in what's
 * left: the deadline cuts in this order, so the first one skipped, a topic asked as often as any
 * kept, fits in part instead. So every topic asked most stays in with the core that teaches it
 * cheapest before any topic asked less, and before any topic gets a second skill. `covered` holds the topics the plan already teaches without these
 * cores (done, or tested out): a topic that's in already brings nothing new.
 */
function rankCores({
  budget,
  covered,
  coveredParts,
  skills,
  worth,
}: {
  budget: number;
  covered: ReadonlySet<string>;
  /** The parts the plan already teaches without these cores (done, or tested out). */
  coveredParts: ReadonlySet<string>;
  skills: readonly CoreSkill[];
  worth: Worth;
}): { kept: Set<string>; order: string[] } {
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]));
  const brought = new Set(covered);
  const ranked = new Set<string>();
  const kept = new Set<string>();

  const rankAll = (inPart: (skill: CoreSkill) => boolean) =>
    skills
      .filter((skill) => !ranked.has(skill.skillId) && inPart(skill))
      .map((skill) => toCandidate({ byId, covered: brought, kept, skill, worth }))
      .toSorted(compareCandidates);

  const rankBest = (inPart: (skill: CoreSkill) => boolean) => rankAll(inPart)[0];

  const rank = ({ candidate, fits }: { candidate: Candidate; fits: boolean }) => {
    candidate.skills.toReversed().forEach((skill) => {
      ranked.add(skill.skillId);

      if (fits) {
        kept.add(skill.skillId);
        (worth.topics.get(skill.skillId) ?? []).forEach((topic) => brought.add(topic.key));
      }
    });
  };

  // Each part's best core that still leaves the other parts room for their cheapest one. A part
  // left with only what the learner showed they know keeps no floor: they know it already.
  const keepPartFloors = ({ left, parts }: { left: number; parts: readonly string[] }): number => {
    const options = parts
      .flatMap((part) => {
        const candidates = rankAll((skill) => worth.parts.get(skill.skillId) === part).filter(
          (candidate) => !candidate.known,
        );

        const [best] = candidates;
        return best ? [{ best, candidates, part }] : [];
      })
      .toSorted((a, b) => compareCandidates(a.best, b.best));

    const [next, ...rest] = options;

    if (!next) {
      return left;
    }

    const reserve = rest.reduce(
      (sum, option) => sum + Math.min(...option.candidates.map((candidate) => candidate.minutes)),
      0,
    );

    const chosen =
      next.candidates.find((candidate) => candidate.minutes <= left - reserve) ??
      next.candidates.find((candidate) => candidate.minutes <= left);

    // A part none of whose cores fits comes first among the cut ones, so it fits in part.
    const cheapest = next.candidates.toSorted((a, b) => a.minutes - b.minutes)[0];
    const taken = chosen ?? cheapest;

    if (taken) {
      rank({ candidate: taken, fits: Boolean(chosen) });
    }

    return keepPartFloors({
      left: left - (chosen?.minutes ?? 0),
      parts: rest.map((option) => option.part),
    });
  };

  const rankNext = ({ floor, left }: { floor: number; left: number }): void => {
    const best = rankBest(() => true);

    if (!best) {
      return;
    }

    const priority = getPriority(best);
    const fits = priority >= floor && best.minutes <= left;
    rank({ candidate: best, fits });

    rankNext(
      fits ? { floor, left: left - best.minutes } : { floor: Math.max(floor, priority), left },
    );
  };

  const parts = [
    ...new Set(skills.flatMap((skill) => worth.parts.get(skill.skillId) ?? [])),
  ].filter((part) => !coveredParts.has(part));

  rankNext({ floor: 0, left: keepPartFloors({ left: budget, parts }) });

  return { kept, order: [...ranked] };
}

/**
 * The topics and the parts of subjects the plan teaches with skills that have no core left to
 * place (done, tested out).
 */
function listCovered({ pending, worth }: { pending: readonly CoreSkill[]; worth: Worth }): {
  parts: Set<string>;
  topics: Set<string>;
} {
  const pendingIds = new Set(pending.map((skill) => skill.skillId));
  const placed = [...worth.topics].filter(([skillId]) => !pendingIds.has(skillId));

  return {
    parts: new Set(placed.flatMap(([skillId]) => worth.parts.get(skillId) ?? [])),
    topics: new Set(placed.flatMap(([, topics]) => topics.map((topic) => topic.key))),
  };
}

/**
 * The plan's units with the cores an area can't keep put last among the cores, when even every
 * skill's core doesn't fit before the deadline. Each area keeps, in the time its cores had, the
 * topics the exam asks most, then the ones asked less, then second cores of a topic (see
 * `rankCores`), and the rest go last in that order: the deadline cuts the least asked, and the
 * first one cut fits in part, which keeps its topic in the plan. Laid out in teaching order
 * instead, a plan short on time left out what its areas' later phases reach (an ENEM's genetics
 * and organic chemistry); ranked by topics per minute, it left out the big topics asked most
 * (mechanics, heat) for small ones nobody ranked. Null when every core fits.
 */
function putLeastWorthCoresLast({
  dropped,
  units,
  worth,
}: {
  /** The units a first schedule of `units` couldn't fit. */
  dropped: readonly QueueUnit[];
  /** The plan's units, every core first (see `putCoresFirst`). */
  units: readonly QueueUnit[];
  worth: Worth;
}): QueueUnit[] | null {
  const missing = sumMissingCores(dropped);

  if (missing.size === 0) {
    return null;
  }

  const coreSkills = listCoreSkills(units);
  const byArea = Map.groupBy(coreSkills, (skill) => skill.area);
  const covered = listCovered({ pending: coreSkills, worth });

  // Each area's cut cores with their place in its order, so the deadline cuts the last of them.
  const last = new Map(
    [...missing].flatMap(([area, minutes]) => {
      const skills = byArea.get(area) ?? [];
      const total = skills.reduce((sum, skill) => sum + skill.minutes, 0);

      const { kept, order } = rankCores({
        budget: total - minutes,
        covered: covered.topics,
        coveredParts: covered.parts,
        skills,
        worth,
      });

      return order
        .filter((skillId) => !kept.has(skillId))
        .map((skillId, index) => [skillId, index] as const);
    }),
  );

  const isLast = (unit: QueueUnit) => isCutCore(unit) && last.has(unit.skillId);
  const placeOf = (unit: QueueUnit) => last.get(unit.skillId ?? "") ?? 0;
  const depthStart = units.findIndex((unit) => unit.depth);
  const coreEnd = depthStart === -1 ? units.length : depthStart;
  const cores = units.slice(0, coreEnd);

  return [
    ...cores.filter((unit) => !isLast(unit)),
    ...cores.filter((unit) => isLast(unit)).toSorted((a, b) => placeOf(a) - placeOf(b)),
    ...units.slice(coreEnd),
  ];
}

/**
 * A plan short on time, every skill's core first, laid out by `schedulePending`. When even the
 * cores don't fit, an exam's cores the deadline cuts are the ones worth least in each subject (see
 * `putLeastWorthCoresLast`), not the ones the teaching order reaches last. Other goals (`worth`
 * null) weigh their skills alike and follow their path: what it reaches last waits.
 */
export function scheduleCoresFirst<TSchedule extends { dropped: readonly QueueUnit[] }>({
  schedulePending,
  units,
  worth,
}: {
  schedulePending: (units: readonly QueueUnit[]) => TSchedule;
  units: readonly QueueUnit[];
  worth: Worth | null;
}): TSchedule {
  const first = schedulePending(units);
  const reordered = worth && putLeastWorthCoresLast({ dropped: first.dropped, units, worth });

  return reordered ? schedulePending(reordered) : first;
}
