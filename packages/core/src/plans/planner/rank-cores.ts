import { type QueueUnit } from "./plan-units";
import { type ScoredTopic } from "./topic-weights";

type CoreSkill = {
  announced: boolean;
  area: string;
  minutes: number;
  position: number;
  skillId: string;
};

export type Worth = {
  announcedTopics: ReadonlySet<string>;
  focused: ReadonlySet<string>;
  gaps: ReadonlySet<string>;
  known: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  values: ReadonlyMap<string, number>;
};

export function isCutCore(unit: QueueUnit): unit is QueueUnit & { skillId: string } {
  const kept = unit.outcome || unit.inProgress;
  return unit.kind === "lesson" && unit.skillId !== null && !unit.depth && !kept;
}

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

type Candidate = {
  focused: boolean;
  level: number;
  atLevel: number;
  minutes: number;
  position: number;
  rank: SkillRank;
  skills: CoreSkill[];
  topics: number;
  value: number;
};

const missedTopicsByWorth = new WeakMap<Worth, ReadonlySet<string>>();

function getMissedTopics(worth: Worth): ReadonlySet<string> {
  const known = missedTopicsByWorth.get(worth);

  if (known) {
    return known;
  }

  const missed = new Set(
    [...worth.gaps].flatMap((skillId) =>
      (worth.topics.get(skillId) ?? []).map((topic) => topic.key),
    ),
  );

  missedTopicsByWorth.set(worth, missed);
  return missed;
}

function toCandidate({
  byId,
  covered,
  kept,
  skill,
  worth,
}: {
  byId: ReadonlyMap<string, CoreSkill>;
  covered: ReadonlySet<string>;
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

  const rank = skills
    .map((item) => getSkillRank({ covered, skill: item, worth }))
    .reduce((best, next) => (compareRanks(next, best) > 0 ? next : best));

  const counts = (skillId: string) =>
    rank.priority < NOT_KNOWN_PRIORITY || !worth.known.has(skillId);

  const fresh = skills.flatMap((item) =>
    counts(item.skillId)
      ? (worth.topics.get(item.skillId) ?? [])
          .filter((topic) => !covered.has(topic.key))
          .map((topic) => ({ ...topic, focused: worth.focused.has(item.skillId) }))
      : [],
  );

  const topics = fresh.reduce(
    (best, topic) => best.set(topic.key, Math.max(best.get(topic.key) ?? 0, topic.score)),
    new Map<string, number>(),
  );

  const level = Math.max(0, ...topics.values());

  const missed = getMissedTopics(worth);

  const atLevel = [...topics].filter(
    ([key, score]) => score === level && (!rank.gap || missed.has(key)),
  ).length;

  return {
    atLevel,
    focused: fresh.some((topic) => topic.focused),
    level,
    minutes: skills.reduce((sum, item) => sum + item.minutes, 0),
    position: skill.position,
    rank,
    skills,
    topics: [...topics.values()].reduce((sum, score) => sum + score, 0),
    value: skills.reduce((sum, item) => sum + (worth.values.get(item.skillId) ?? 0), 0),
  };
}

/** Above every topic level (0 to 3). */
const NOT_KNOWN_PRIORITY = 4;

const ANNOUNCED_PRIORITY = 2 * NOT_KNOWN_PRIORITY;

type SkillRank = { gap: boolean; priority: number };

function getSkillRank({
  covered,
  skill,
  worth,
}: {
  covered: ReadonlySet<string>;
  skill: CoreSkill;
  worth: Worth;
}): SkillRank {
  const fresh = (worth.topics.get(skill.skillId) ?? []).filter((topic) => !covered.has(topic.key));
  const level = Math.max(0, ...fresh.map((topic) => topic.score));
  const missed = getMissedTopics(worth);

  const announced = skill.announced || fresh.some((topic) => worth.announcedTopics.has(topic.key));

  const priority = worth.known.has(skill.skillId)
    ? level
    : (announced ? ANNOUNCED_PRIORITY : NOT_KNOWN_PRIORITY) + level;

  const gap =
    worth.gaps.has(skill.skillId) ||
    fresh.some((topic) => topic.score === level && missed.has(topic.key));

  return { gap, priority };
}

function compareRanks(a: SkillRank, b: SkillRank): number {
  return a.priority - b.priority || Number(a.gap) - Number(b.gap);
}

function compareCandidates(a: Candidate, b: Candidate): number {
  const perMinute = (candidate: Candidate, gain: number) => gain / Math.max(candidate.minutes, 1);

  return (
    compareRanks(b.rank, a.rank) ||
    Number(b.focused) - Number(a.focused) ||
    perMinute(b, b.atLevel) - perMinute(a, a.atLevel) ||
    perMinute(b, b.topics) - perMinute(a, a.topics) ||
    perMinute(b, b.value) - perMinute(a, a.value) ||
    a.position - b.position
  );
}

function rankCores({
  budget,
  covered,
  skills,
  worth,
}: {
  budget: number;
  covered: ReadonlySet<string>;
  skills: readonly CoreSkill[];
  worth: Worth;
}): { kept: Set<string>; order: string[] } {
  const byId = new Map(skills.map((skill) => [skill.skillId, skill]));
  const brought = new Set(covered);
  const ranked = new Set<string>();
  const kept = new Set<string>();
  const teachesTopics = (skill: CoreSkill) => (worth.topics.get(skill.skillId) ?? []).length > 0;

  const rankBest = () =>
    skills
      .filter((skill) => !ranked.has(skill.skillId))
      .map((skill) => toCandidate({ byId, covered: brought, kept, skill, worth }))
      .toSorted(compareCandidates)[0];

  const rank = ({ candidate, fits }: { candidate: Candidate; fits: boolean }) => {
    candidate.skills.toReversed().forEach((skill) => {
      ranked.add(skill.skillId);

      if (fits) {
        kept.add(skill.skillId);
        (worth.topics.get(skill.skillId) ?? []).forEach((topic) => brought.add(topic.key));
      }
    });
  };

  const toTopPath = (candidate: Candidate) => {
    const [head, ...rest] = candidate.skills.filter((skill) => !ranked.has(skill.skillId));
    const rankOf = (skill: CoreSkill) => getSkillRank({ covered: brought, skill, worth });

    const top = head
      ? rest.reduce(
          (best, skill) => (compareRanks(rankOf(skill), rankOf(best)) > 0 ? skill : best),
          head,
        )
      : null;

    return top ? toCandidate({ byId, covered: brought, kept, skill: top, worth }) : candidate;
  };

  const rankNext = ({ floor, left }: { floor: SkillRank; left: number }): void => {
    const best = rankBest();

    if (!best) {
      return;
    }

    const fitsIn = (candidate: Candidate) =>
      compareRanks(candidate.rank, floor) >= 0 && candidate.minutes <= left;

    const pick = fitsIn(best) ? best : toTopPath(best);
    const fits = fitsIn(pick);

    const [target] = pick.skills;
    const reaches = left > pick.minutes - (target?.minutes ?? 0);

    const skipped =
      fits || reaches
        ? pick
        : {
            ...pick,
            skills: pick.skills.filter((skill) => skill === target || !teachesTopics(skill)),
          };

    rank({ candidate: skipped, fits });

    rankNext(
      fits
        ? { floor, left: left - pick.minutes }
        : { floor: reaches && compareRanks(pick.rank, floor) > 0 ? pick.rank : floor, left },
    );
  };

  rankNext({ floor: { gap: false, priority: 0 }, left: budget });

  return { kept, order: [...ranked] };
}

function listCovered({
  pending,
  worth,
}: {
  pending: readonly CoreSkill[];
  worth: Worth;
}): Set<string> {
  const pendingIds = new Set(pending.map((skill) => skill.skillId));
  const placed = [...worth.topics].filter(([skillId]) => !pendingIds.has(skillId));

  return new Set(placed.flatMap(([, topics]) => topics.map((topic) => topic.key)));
}

export function rankShortAreas({
  missing,
  units,
  worth,
}: {
  missing: ReadonlyMap<string, number>;
  units: readonly QueueUnit[];
  worth: Worth;
}): ReturnType<typeof rankCores>[] {
  const coreSkills = listCoreSkills(units);
  const byArea = Map.groupBy(coreSkills, (skill) => skill.area);
  const covered = listCovered({ pending: coreSkills, worth });

  return [...missing].map(([area, minutes]) => {
    const skills = byArea.get(area) ?? [];
    const total = skills.reduce((sum, skill) => sum + skill.minutes, 0);

    return rankCores({ budget: total - minutes, covered, skills, worth });
  });
}
