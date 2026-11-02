import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { hasEveryTopic } from "./feasibility-topics";
import { getAreaFoundationIds, getSkillArea } from "./graph-areas";
import { getBaseChoices } from "./plan-bases";
import { type PlannedItem } from "./plan-items";
import { PLAN_EPSILON } from "./plan-precision";
import { type SkillRequirement, isCompleted } from "./selected-requirement";

export type ExamSubjectShare = { areas: readonly string[]; share: number };

type ScopedSkill = { area: string; skillId: string; weight: number };

type SelectedSkill = SelectedCoverage["skills"][number];

function getExamWorth({
  examSubjects,
  skills,
}: {
  examSubjects: readonly ExamSubjectShare[];
  skills: readonly ScopedSkill[];
}): Map<string, number> | null {
  const worth = examSubjects.flatMap((subject) => {
    const own = skills.filter((skill) => subject.areas.includes(skill.area));
    const weight = own.reduce((total, skill) => total + skill.weight, 0);

    return weight > 0
      ? own.map((skill) => [skill.skillId, (subject.share * skill.weight) / weight] as const)
      : [];
  });

  return worth.some(([, value]) => value > 0) ? new Map(worth) : null;
}

function listScope({
  examSubjects,
  input,
}: {
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
}) {
  const missed = input.missedSkillIds ?? new Set<string>();
  const skippedAreas = new Set(input.settings.skippedAreas);

  const choices = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });

  const pastBasics = getAreaFoundationIds({
    areas: new Set(input.settings.pastBasicsAreas),
    graph: input.graph,
    prerequisites: input.prerequisites,
  });

  const skills = input.graph.skills
    .map((skill) => ({
      area: getSkillArea({ graph: input.graph, skill }),
      skillId: skill.skillId,
      weight: skill.weight ?? 1,
    }))
    .filter(
      (skill) =>
        !skippedAreas.has(skill.area) &&
        choices.get(skill.skillId) !== "skip" &&
        (!pastBasics.has(skill.skillId) || missed.has(skill.skillId)),
    );

  const examWorth = examSubjects ? getExamWorth({ examSubjects, skills }) : null;

  return {
    measure: examWorth ? ("exam" as const) : ("goal" as const),
    skills: skills.map((skill) => ({
      skillId: skill.skillId,
      worth: examWorth ? (examWorth.get(skill.skillId) ?? 0) : skill.weight,
    })),
  };
}

function sumRawBefore({
  built,
  deadline,
  item,
}: {
  built: BuiltPlan;
  deadline: string;
  item: PlannedItem;
}): number {
  const days = built.lessonRawMinutes.get(item.key) ?? new Map<string, number>();
  return [...days].reduce((sum, [day, minutes]) => (day < deadline ? sum + minutes : sum), 0);
}

function listCoveredLessons({
  built,
  deadline,
  raw,
}: {
  built: BuiltPlan;
  deadline: string;
  raw: ReadonlyMap<string, number>;
}): Map<string, number> {
  return new Map(
    built.items.flatMap((item) => {
      const minutes = item.lessonId ? raw.get(item.lessonId) : undefined;

      if (!item.lessonId || minutes === undefined) {
        return [];
      }

      if (isCompleted(item)) {
        return [[item.lessonId, minutes] as const];
      }

      return item.status === "todo"
        ? [[item.lessonId, sumRawBefore({ built, deadline, item })] as const]
        : [];
    }),
  );
}

function listCoveredStandIns({
  built,
  deadline,
}: {
  built: BuiltPlan;
  deadline: string;
}): Map<string, number> {
  return built.items.reduce((covered, item) => {
    if (item.kind !== "lesson" || item.lessonId || !item.skillId || item.status !== "todo") {
      return covered;
    }

    const before = sumRawBefore({ built, deadline, item });
    return covered.set(item.skillId, (covered.get(item.skillId) ?? 0) + before);
  }, new Map<string, number>());
}

function listShortLessons({
  built,
  covered,
  requirement,
  skills,
}: {
  built: BuiltPlan;
  covered: ReadonlyMap<string, number>;
  requirement: ReadonlyMap<string, SkillRequirement>;
  skills: readonly SelectedSkill[];
}): SelectedCoverage["shortLessons"] {
  const held = new Set(
    built.items.flatMap((item) => (item.lessonId && item.status === "todo" ? [item.lessonId] : [])),
  );

  const lessons = Map.groupBy(
    skills
      .filter((skill) => skill.state === "measured")
      .flatMap((skill) =>
        [...(requirement.get(skill.skillId)?.lessons ?? [])].map(([lessonId, requiredRaw]) => ({
          lessonId,
          requiredRaw,
          skillId: skill.skillId,
        })),
      ),
    (entry) => entry.lessonId,
  );

  return [...lessons]
    .map(([lessonId, entries]) => ({
      countedRaw: covered.get(lessonId) ?? 0,
      lessonId,
      requiredRaw: entries[0]?.requiredRaw ?? 0,
      skillIds: entries.map((entry) => entry.skillId).toSorted(),
    }))
    .filter(
      (lesson) =>
        held.has(lesson.lessonId) && lesson.countedRaw < lesson.requiredRaw - PLAN_EPSILON,
    )
    .toSorted((a, b) => a.lessonId.localeCompare(b.lessonId));
}

/** Each lesson counts once, however many skills share it. */
export function getWholeShortfall({
  built,
  deadline,
  examSubjects,
  input,
  requirement,
  settled,
}: {
  built: BuiltPlan;
  deadline: string;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  requirement: ReadonlyMap<string, SkillRequirement>;
  settled: ReadonlySet<string>;
}): number {
  const raw = new Map([...requirement.values()].flatMap((skill) => [...skill.lessons]));
  const lessons = listCoveredLessons({ built, deadline, raw });
  const standIns = listCoveredStandIns({ built, deadline });

  const measured = listScope({ examSubjects, input }).skills.flatMap(({ skillId }) => {
    const required = requirement.get(skillId);
    return required && !settled.has(skillId) ? [{ required, skillId }] : [];
  });

  const lessonsLeft = new Map(
    measured.flatMap(({ required }) =>
      [...required.lessons].map(
        ([lessonId, minutes]) =>
          [lessonId, Math.max(0, minutes - (lessons.get(lessonId) ?? 0))] as const,
      ),
    ),
  );

  const standInsLeft = measured.reduce(
    (sum, { required, skillId }) =>
      sum + Math.max(0, required.standIn - (standIns.get(skillId) ?? 0)),
    0,
  );

  return [...lessonsLeft.values()].reduce((sum, minutes) => sum + minutes, standInsLeft);
}

export function getSkillValue(skill: SelectedSkill): number {
  if (skill.state === "settled") {
    return 1;
  }

  return skill.state === "unknown" ? 0 : Math.min(1, skill.coveredRaw / skill.requiredRaw);
}

export function getCoverage({
  built,
  deadline,
  examSubjects,
  input,
  requirement,
  settled,
  targetDate,
}: {
  built: BuiltPlan;
  deadline: string;
  examSubjects: readonly ExamSubjectShare[] | null;
  input: BuildPlanInput;
  requirement: ReadonlyMap<string, SkillRequirement>;
  settled: ReadonlySet<string>;
  targetDate: string;
}): SelectedCoverage {
  const scope = listScope({ examSubjects, input });

  const raw = new Map([...requirement.values()].flatMap((skill) => [...skill.lessons]));

  const lessons = listCoveredLessons({ built, deadline, raw });
  const standIns = listCoveredStandIns({ built, deadline });

  const skills = scope.skills.map(({ skillId, worth }) => {
    const required = requirement.get(skillId);
    const lessonMinutes = [...(required?.lessons.values() ?? [])].reduce((a, b) => a + b, 0);
    const requiredRaw = lessonMinutes + (required?.standIn ?? 0);

    const coveredRaw =
      [...(required?.lessons.keys() ?? [])].reduce((sum, id) => sum + (lessons.get(id) ?? 0), 0) +
      Math.min(required?.standIn ?? 0, standIns.get(skillId) ?? 0);

    if (settled.has(skillId)) {
      return { coveredRaw: requiredRaw, requiredRaw, skillId, state: "settled" as const, worth };
    }

    return {
      coveredRaw: Math.min(requiredRaw, coveredRaw),
      requiredRaw,
      skillId,
      state: requiredRaw > PLAN_EPSILON ? ("measured" as const) : ("unknown" as const),
      worth,
    };
  });

  const total = skills.reduce((sum, skill) => sum + skill.worth, 0);
  const covered = skills.reduce((sum, skill) => sum + skill.worth * getSkillValue(skill), 0);

  const coreFits = hasEveryTopic({
    built: {
      ...built,
      items: built.items.filter(
        (item) => item.status !== "todo" || sumRawBefore({ built, deadline, item }) > PLAN_EPSILON,
      ),
    },
    known: input.knownSkillIds ?? new Set(),
    skills: input.graph.skills,
  });

  const whole = skills.every(
    (skill) =>
      skill.state === "settled" ||
      (skill.state === "measured" && skill.coveredRaw >= skill.requiredRaw - PLAN_EPSILON),
  );

  return {
    basis: "selected",
    coreFits,
    coveredShare: total > 0 ? Math.min(1, Math.max(0, covered / total)) : null,
    deadline,
    fits: coreFits && total > 0 && whole,
    measure: scope.measure,
    shortLessons: listShortLessons({ built, covered: lessons, requirement, skills }),
    skills,
    targetDate,
  };
}
