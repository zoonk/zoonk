import { apportion } from "@zoonk/utils/apportion";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { PLAN_EPSILON } from "./plan-precision";
import { type PlanGraph, type PlanGraphSkill } from "./plan-state";
import { type PlannerLesson, type QueueUnit, assignLessonSkills } from "./plan-units";

type TopicGroup = NonNullable<ExamStructure["subjects"][number]["topicGroups"]>[number];
type Domain = TopicGroup & { share: number };

export function getExamDomainGroups(groups: readonly TopicGroup[] = []): Domain[] {
  const shared = groups.filter(
    (group): group is Domain =>
      typeof group.share === "number" && group.share >= 0 && group.share <= 1,
  );

  const total = shared.reduce((sum, group) => sum + group.share, 0);
  const unique = new Set(groups.map((group) => group.name));

  return shared.length === groups.length &&
    unique.size === groups.length &&
    Math.abs(total - 1) < PLAN_EPSILON
    ? shared
    : [];
}

export type ExamDomains = ReadonlyMap<string, readonly Domain[]>;

export function readExamDomains(structure: ExamStructure | null): { examDomains?: ExamDomains } {
  const examDomains = new Map(
    (structure?.subjects ?? []).flatMap(({ name, topicGroups }) => {
      const groups = getExamDomainGroups(topicGroups);
      return groups.length > 0 ? [[name, groups] as const] : [];
    }),
  );

  return examDomains.size > 0 ? { examDomains } : {};
}

type SizedSkill = { estimate: number; fixed: boolean; floor: number; skill: PlanGraphSkill };

function findBestDomains({
  groups,
  skill,
}: {
  groups: readonly Domain[];
  skill: PlanGraphSkill;
}): Domain[] {
  const matches = groups.map(
    (group) => skill.topics?.filter((topic) => group.topics.includes(topic)).length ?? 0,
  );

  const most = Math.max(...matches);
  return most > 0 ? groups.filter((_, index) => matches[index] === most) : [];
}

/**
 * Each skill goes to the heading most of its topics are under. A skill tied between headings goes
 * to the one with the fewest skills so far, so a heading only such a skill covers still has one.
 */
function assignDomains({
  groups,
  skills,
}: {
  groups: readonly Domain[];
  skills: readonly SizedSkill[];
}) {
  const best = new Map(
    skills.map((sized) => [sized, findBestDomains({ groups, skill: sized.skill })]),
  );

  const counts = new Map(groups.map((group) => [group, 0]));
  const chosen = new Map<SizedSkill, Domain>();

  const choose = (sized: SizedSkill, group: Domain) => {
    chosen.set(sized, group);
    counts.set(group, (counts.get(group) ?? 0) + 1);
  };

  best.forEach(([only, ...others], sized) => {
    if (only && others.length === 0) {
      choose(sized, only);
    }
  });

  best.forEach((tied, sized) => {
    const fewest = tied.toSorted(
      (first, second) => (counts.get(first) ?? 0) - (counts.get(second) ?? 0),
    )[0];

    if (fewest && tied.length > 1) {
      choose(sized, fewest);
    }
  });

  return Map.groupBy(skills, (sized) => chosen.get(sized));
}

function sizeSubject({
  groups,
  skills,
}: {
  groups: readonly Domain[];
  skills: readonly SizedSkill[];
}): PlanGraphSkill[] {
  const assigned = assignDomains({ groups, skills });
  const parts = groups.map((group) => ({ group, skills: assigned.get(group) ?? [] }));

  if (parts.some((part) => part.skills.length === 0)) {
    return [];
  }

  const total = parts.reduce(
    (sum, part) =>
      sum + part.skills.reduce((count, skill) => count + Math.max(skill.floor, skill.estimate), 0),
    0,
  );

  const shares = groups.map((group) => group.share);
  const targets = apportion({ total, weights: shares });
  const floors = parts.map((part) => part.skills.reduce((sum, skill) => sum + skill.floor, 0));
  const missing = Math.max(0, total - floors.reduce((sum, floor) => sum + floor, 0));
  const canGrow = parts.map((part) => part.skills.some((skill) => !skill.fixed));

  const deficits = targets.map((target, index) =>
    canGrow[index] ? Math.max(0, target - (floors[index] ?? 0)) : 0,
  );

  const weights = deficits.some(Boolean) ? deficits : canGrow.map(Number);
  const extras = canGrow.some(Boolean) ? apportion({ total: missing, weights }) : [];

  return parts.flatMap(({ group, skills: inDomain }, index) => {
    const open = inDomain.filter(({ fixed }) => !fixed);

    const additions = apportion({
      total: extras[index] ?? 0,
      weights: open.map(({ estimate, floor }) => Math.max(0, estimate - floor)),
    });

    const added = new Map(
      open.map(({ skill }, position) => [skill.skillId, additions[position] ?? 0]),
    );

    return inDomain.map(({ estimate, fixed, floor, skill }) => ({
      ...skill,
      domain: { estimate, name: group.name, share: group.share },
      lessons: fixed ? skill.lessons : floor + (added.get(skill.skillId) ?? 0),
    }));
  });
}

export function sizeExamDomains({
  domains,
  graph,
  lessons,
  settled,
  written = new Set(),
}: {
  domains?: ExamDomains;
  graph: PlanGraph;
  lessons: readonly PlannerLesson[];
  settled: ReadonlySet<string>;
  written?: ReadonlySet<string>;
}): PlanGraph {
  if (!domains && !graph.skills.some((skill) => skill.domain)) {
    return graph;
  }

  const byArea = Map.groupBy(graph.skills, (skill) => skill.area);

  const authored = Map.groupBy(
    assignLessonSkills({ lessons, skills: graph.skills }).values(),
    (id) => id,
  );

  const sized = new Map(
    [...(domains ?? [])].flatMap(([area, groups]) => {
      const skills = (byArea.get(area) ?? []).flatMap((skill) => {
        if (skill.extra || skill.outcome || written.has(skill.skillId)) {
          return [];
        }

        const taught = Math.max(1, authored.get(skill.skillId)?.length ?? 0);
        const done = settled.has(skill.skillId);
        const floor = done ? Math.max(taught, skill.lessons) : taught;
        const estimate = skill.domain?.estimate ?? skill.lessons;

        return [{ estimate, fixed: done || Boolean(skill.outlined), floor, skill }];
      });

      return sizeSubject({ groups, skills }).map((skill) => [skill.skillId, skill] as const);
    }),
  );

  return {
    ...graph,
    skills: graph.skills.map((skill) => {
      const adjusted = sized.get(skill.skillId);

      if (adjusted || !skill.domain) {
        return adjusted ?? skill;
      }

      const { domain, ...unweighted } = skill;
      const fixed = skill.outlined || settled.has(skill.skillId) || written.has(skill.skillId);
      return { ...unweighted, lessons: fixed ? skill.lessons : domain.estimate };
    }),
  };
}

function isHeld(unit: QueueUnit): boolean {
  return Boolean(unit.announced || unit.inProgress || unit.outcome || unit.dueBy);
}

export function getDomainLessonPasses({
  domains,
  units,
}: {
  domains: ReadonlyMap<string, NonNullable<PlanGraphSkill["domain"]>>;
  units: readonly QueueUnit[];
}): Map<QueueUnit, number> {
  const belongs = units.flatMap((unit) => {
    const domain = domains.get(unit.skillId ?? "");
    return domain && unit.kind === "lesson" ? [{ domain, unit }] : [];
  });

  const byDomain = Map.groupBy(belongs, ({ domain, unit }) =>
    JSON.stringify([unit.area, domain.name]),
  );

  return new Map(
    [...byDomain.values()].flatMap((inDomain) => {
      const fixed = inDomain.reduce((sum, { unit }) => sum + (isHeld(unit) ? unit.minutes : 0), 0);
      const progress = { minutes: fixed };

      return inDomain.flatMap(({ domain, unit }) => {
        if (isHeld(unit)) {
          return [];
        }

        progress.minutes += unit.minutes;
        const pass = domain.share > 0 ? progress.minutes / domain.share : Infinity;
        return [[unit, pass] as const];
      });
    }),
  );
}
