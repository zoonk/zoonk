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
export type Worth = {
  /**
   * The topics a class test's announced questions ask (those of the skills they ask about, see
   * `findAnnouncedSkillIds`): a skill bringing one in ranks as announced (see `getSkillRank`).
   */
  announcedTopics: ReadonlySet<string>;
  /**
   * The skills the learner focused on: among topics the exam asks as often, theirs stay first. A
   * focus never keeps a topic asked less in place of one asked more ("more biology" keeps
   * physics' frequent topics); it gives its part the depth and the time instead.
   */
  focused: ReadonlySet<string>;
  /**
   * The skills any of the learner's answers missed, placement included, even when a later one was
   * right: among topics the exam asks as often, a gap stays first (see `compareCandidates`).
   */
  gaps: ReadonlySet<string>;
  /**
   * The skills the learner showed they know (see `isKnownClaim`), none of them missed anywhere: a
   * plan short on time cuts them before anything they don't know yet, however often the exam asks
   * them. Pedro's class test cut the membrane, which placement found missing, and kept prokaryotes,
   * which he got right.
   */
  known: ReadonlySet<string>;
  prerequisites: ReadonlyMap<string, readonly string[]>;
  topics: ReadonlyMap<string, readonly ScoredTopic[]>;
  values: ReadonlyMap<string, number>;
};

/** A core the plan may leave out: never an outcome's, nor the rest of the chapter in progress. */
export function isCutCore(unit: QueueUnit): unit is QueueUnit & { skillId: string } {
  const kept = unit.outcome || unit.inProgress;
  return unit.kind === "lesson" && unit.skillId !== null && !unit.depth && !kept;
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
 * A skill's cost to keep, with what it builds on, and how often the exam asks the topics it brings
 * into the plan.
 */
type Candidate = {
  /** It brings in a topic of the part of the subject the learner focused on. */
  focused: boolean;
  /** How often the exam asks the most asked topic it brings in; 0 when it brings none. */
  level: number;
  /**
   * How many of the topics it brings in are asked that often, and missed when its rank is a gap's:
   * a way in that bundles a missed base with a topic nobody missed is worth its missed topics.
   */
  atLevel: number;
  minutes: number;
  position: number;
  /** Where its cut ranks: as the skill it brings in that ranks highest (see `getSkillRank`). */
  rank: SkillRank;
  /** The skill it's for first, then what that builds on. */
  skills: CoreSkill[];
  /** The topics it brings in, each scored by how often the exam asks it. */
  topics: number;
  /** What the skills it brings in are worth to the exam (their notice weight and the learner's gap). */
  value: number;
};

const missedTopicsByWorth = new WeakMap<Worth, ReadonlySet<string>>();

/**
 * The topics a skill the learner missed teaches: missed too, so the cheapest way into one ranks as
 * missed. ENEM's placement missed a skill on molecules, cells and tissues, and the topic's
 * cheapest way in, which the learner hadn't been asked about, left for ecology asked as often.
 */
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

  const rank = skills
    .map((item) => getSkillRank({ covered, skill: item, worth }))
    .reduce((best, next) => (compareRanks(next, best) > 0 ? next : best));

  // A way in that ranks as something the learner doesn't know is worth what they don't know:
  // Câmara's official correspondence, which they showed they know, came in with the text genres
  // it builds on, and its four topics made that way the cheapest per topic, so it kept 11 lessons
  // while word meaning, which they didn't know, stayed out.
  const counts = (skillId: string) =>
    rank.priority < NOT_KNOWN_PRIORITY || !worth.known.has(skillId);

  const fresh = skills.flatMap((item) =>
    counts(item.skillId)
      ? (worth.topics.get(item.skillId) ?? [])
          .filter((topic) => !covered.has(topic.key))
          .map((topic) => ({ ...topic, focused: worth.focused.has(item.skillId) }))
      : [],
  );

  // A topic counts once, as much as the skill that brings it in most.
  const topics = fresh.reduce(
    (best, topic) => best.set(topic.key, Math.max(best.get(topic.key) ?? 0, topic.score)),
    new Map<string, number>(),
  );

  const level = Math.max(0, ...topics.values());

  // Câmara's "official correspondence" came in with the missed text-genres base it builds on and
  // counted as missed with it, so it outranked "legislative drafting", which the learner missed.
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

/** Above every topic level (0 to 3): what the learner doesn't know yet ranks over what they do. */
const NOT_KNOWN_PRIORITY = 4;

/** Above every topic level the learner doesn't know: what the class test's material announces. */
const ANNOUNCED_PRIORITY = 2 * NOT_KNOWN_PRIORITY;

/**
 * Where a skill's cut ranks, as the owner's rule ranks its topics: `priority` puts a topic its
 * class test's material announces above any other (the teacher said it comes up; a skill bringing
 * in the topic of an announced skill is announced too: the membrane's lessons were the way into the
 * osmosis essay's topic once Pedro answered osmosis right, and a settle set them aside), then how
 * often the exam asks the most asked topic it brings in that the plan doesn't have yet, and what
 * the learner showed they know below everything they don't (practice keeps it either way); among
 * skills of one priority, a `gap` the learner's answers found comes first: a skill they missed, or
 * one bringing in a topic asked that often that a skill they missed teaches. Announced alike,
 * Pedro's osmosis essay outranked organelles, which his notes say come up a lot, and organelles
 * left the plan.
 */
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

/** Above 0 when `a` ranks above `b` (see `SkillRank`). */
function compareRanks(a: SkillRank, b: SkillRank): number {
  return a.priority - b.priority || Number(a.gap) - Number(b.gap);
}

/**
 * The order cores are kept in, the owner's rule for a plan short on time: the topics the exam asks
 * most first (see `getSkillRank`), so the cut takes the least asked whole topics first and a topic
 * asked most never leaves while one asked less keeps its core. A topic brings in the cores it
 * builds on, at its own rank. Among topics that rank alike: the part the learner focused on, then
 * the cheapest way to each of them (the topics asked that often it brings in per minute, then all
 * the topics it brings in, then what it's worth), so the most of them keep their core, and each
 * before any gets a second skill; then teaching order.
 */
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

/**
 * An area's cores in the order the plan keeps them (see `compareCandidates`), each with the skills
 * of its area it builds on (they cost their minutes too), and the ones that fit in `budget`. A core
 * that doesn't fit, with all it brings in, still keeps the way to the skill among them that ranks
 * highest when that fits. Otherwise that way is skipped, and so is everything that ranks lower from
 * then on (asked less, what the learner showed they know, or a topic nobody missed after one the
 * learner missed), even when it would fit in what's left: the deadline cuts in this order, so the
 * first one skipped, a topic asked as often as any kept, fits in part instead, its bases first,
 * unless its bases alone take what's left: then those that teach topics of their own compete for
 * them like any other skill. So every topic asked most stays in before any topic asked less, and
 * before any topic gets a second skill. Skipped whole, Câmara's "rewriting" gave the time
 * Portuguese had left to its word classes, a base only it needed, while "word meaning", which the
 * learner missed and which builds on less, never came in; and data visualization, which placement
 * missed, came 2 minutes short of the time its subject had, which networks and digital security,
 * asked as often, then took whole. `covered` holds the topics the plan already teaches without
 * these cores (done, or tested out): a topic that's in already brings nothing new.
 */
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

  // The way to the skill a candidate brings in that ranks highest, the rest of it left to rank.
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

    // What a way builds on comes first in the time left: when that alone takes it, the way brings
    // in none of the lessons of the skill it's for, so it holds nothing back. A class test's last
    // 4 minutes went to the base of the announced organelles, which never came in, while the
    // membrane, which the learner missed, fit whole. Its bases that teach topics of their own stay
    // to compete for them: left with the way into organelles, prokaryotes never came in for its
    // own topic, and cell theory, asked less, took the 4 minutes it would have fit in.
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

/** The topics the plan teaches with skills that have no core left to place (done, tested out). */
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

/**
 * Each area short on cores (`missing`, see `sumMissingCores`) with its cores in the order it keeps
 * them and the ones that fit in the time they had (see `rankCores`).
 */
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
