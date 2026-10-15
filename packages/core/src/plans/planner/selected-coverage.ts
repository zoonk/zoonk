import { type SelectedCoverage } from "../_utils/selected-summary-contract";
import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { type ExamSubjectShare, getExamWorth } from "./feasibility-coverage";
import { hasEveryTopic } from "./feasibility-topics";
import { getAreaFoundationIds, getSkillArea } from "./graph-areas";
import { getBaseChoices } from "./plan-bases";
import { toIsoDate } from "./plan-calendar";
import { type PlannedItem } from "./plan-items";
import { type SkillRequirement, isCompleted } from "./selected-requirement";

/** Floating-point sums of minutes must not read a covered skill as short. */
const EPSILON = 1e-6;

type SelectedSkill = SelectedCoverage["skills"][number];

/**
 * The skills the plan measures: the graph's, without the ones the learner took out on purpose (an
 * area they skip, a base they chose to skip, the foundations of an area they said they're past the
 * basics of, unless they then missed one), each with what it's worth: its subject's share of the
 * exam (see `getExamWorth`), else its weight.
 */
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

/** The raw lesson minutes an item's time takes on days before the deadline (see `lessonRawMinutes`). */
function sumRawBefore({
  built,
  deadline,
  item,
  raw,
}: {
  built: BuiltPlan;
  deadline: string;
  item: PlannedItem;
  raw: number;
}): number {
  const days = built.lessonRawMinutes.get(item.key);

  if (!days) {
    return item.scheduledFor && toIsoDate(item.scheduledFor) < deadline ? raw : 0;
  }

  return [...days].reduce((sum, [day, minutes]) => (day < deadline ? sum + minutes : sum), 0);
}

/**
 * The raw minutes each of the plan's written lessons covers by the deadline: whole when completed,
 * else its time's portions on days before it, so a long lesson that runs past the deadline counts
 * only what comes before. A lesson the plan doesn't hold covers nothing.
 */
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
        ? [[item.lessonId, sumRawBefore({ built, deadline, item, raw: minutes })] as const]
        : [];
    }),
  );
}

/** What of each skill's stand-in the plan lays out before the deadline, by skill. */
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

    const before = sumRawBefore({ built, deadline, item, raw: 0 });
    return covered.set(item.skillId, (covered.get(item.skillId) ?? 0) + before);
  }, new Map<string, number>());
}

/**
 * The lessons still to do the plan counts less than whole by the deadline (one running past it, or
 * after it), each once with the measured skills it counts for (see `SelectedCoverage.shortLessons`):
 * finishing one is the only completion that changes what the plan covers. A lesson the plan doesn't
 * hold has no item to finish, so it isn't listed.
 */
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
      (lesson) => held.has(lesson.lessonId) && lesson.countedRaw < lesson.requiredRaw - EPSILON,
    )
    .toSorted((a, b) => a.lessonId.localeCompare(b.lessonId));
}

/** How much of a skill counts as covered: all of a settled one, none of an unknown one. */
function getSkillValue(skill: SelectedSkill): number {
  if (skill.state === "settled") {
    return 1;
  }

  return skill.state === "unknown" ? 0 : Math.min(1, skill.coveredRaw / skill.requiredRaw);
}

/**
 * How much of the chosen requirement the selected plan covers by its deadline (see
 * `SelectedSummary.coverage`): each in-scope skill's covered raw minutes over its required ones,
 * weighted by what it's worth, a settled skill counted whole and one with no requirement data
 * counted as none (never as covered). `fits` holds only when every topic is in, every in-scope
 * skill is covered whole and none is unknown. It keeps the goal's date it measured against, and the
 * lessons it counts less than whole (see `listShortLessons`).
 */
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
      state: requiredRaw > EPSILON ? ("measured" as const) : ("unknown" as const),
      worth,
    };
  });

  const total = skills.reduce((sum, skill) => sum + skill.worth, 0);
  const covered = skills.reduce((sum, skill) => sum + skill.worth * getSkillValue(skill), 0);

  const coreFits = hasEveryTopic({
    built,
    known: input.knownSkillIds ?? new Set(),
    skills: input.graph.skills,
  });

  const whole = skills.every(
    (skill) =>
      skill.state === "settled" ||
      (skill.state === "measured" && skill.coveredRaw >= skill.requiredRaw - EPSILON),
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
