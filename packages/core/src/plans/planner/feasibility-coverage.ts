import { type BuildPlanInput, type BuiltPlan } from "./build-plan";
import { getKeptBaseChoices } from "./chosen-bases";
import { getSkillArea } from "./graph-areas";
import { getBaseChoices } from "./plan-bases";
import { type SizedPlanInput } from "./sized-plan";

/**
 * A notice subject the plan teaches: the plan's areas it gathers and its share of the exam, so an
 * exam's coverage counts what its questions are worth.
 */
export type ExamSubjectShare = { areas: readonly string[]; share: number };

type CoveredSkill = { area: string; skillId: string; weight: number };

/** Shared written lessons teach every linked skill even when only one owns their scheduled unit. */
function getOutlinedMinutes({
  built,
  input,
}: {
  built: BuiltPlan;
  input: BuildPlanInput;
}): Map<string, { covered: number; total: number }> {
  const outlined = new Set(
    input.graph.skills.flatMap((skill) =>
      skill.outlined && skill.lessons > 0 ? [skill.skillId] : [],
    ),
  );

  const placed = new Set(
    built.items.flatMap((item) =>
      item.kind === "lesson" && (item.status === "todo" || item.status === "done") && item.lessonId
        ? [item.lessonId]
        : [],
    ),
  );

  const bySkill = Map.groupBy(
    input.lessons.flatMap((lesson) =>
      lesson.skillIds.filter((id) => outlined.has(id)).map((skillId) => ({ lesson, skillId })),
    ),
    (entry) => entry.skillId,
  );

  return new Map(
    [...bySkill].map(([skillId, entries]) => {
      const lessons = [...new Map(entries.map(({ lesson }) => [lesson.lessonId, lesson])).values()];

      return [
        skillId,
        {
          covered: lessons.reduce(
            (sum, lesson) =>
              sum + (placed.has(lesson.lessonId) ? lesson.minutes * input.paceFactor : 0),
            0,
          ),
          total: lessons.reduce((sum, lesson) => sum + lesson.minutes * input.paceFactor, 0),
        },
      ];
    }),
  );
}

/**
 * What each skill is worth to an exam: its subject's share of the exam, shared among the subject's
 * skills by their exam weight. Skills outside the notice's subjects (study strategy, say) aren't
 * questions of the exam. Null when no subject has a share.
 */
function getExamWorth({
  examSubjects,
  skills,
}: {
  examSubjects: readonly ExamSubjectShare[];
  skills: readonly CoveredSkill[];
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

/**
 * How much of each skill fits before the deadline: its finished lessons and what of the rest the
 * plan reaches, as a share of the skill's minutes. A skill with nothing left to plan fits whole.
 */
function getSkillFits({
  built,
  doneMinutes,
  input,
  skills,
}: {
  built: BuiltPlan;
  doneMinutes: ReadonlyMap<string, number>;
  input: BuildPlanInput;
  skills: readonly { skillId: string }[];
}): Map<string, number> {
  const minutes = new Map(built.skillMinutes.map((entry) => [entry.skillId, entry]));
  const outlinedMinutes = getOutlinedMinutes({ built, input });

  return new Map(
    skills.map(({ skillId }) => {
      const entry = outlinedMinutes.get(skillId) ?? minutes.get(skillId);
      const done = doneMinutes.get(skillId) ?? 0;
      const total = done + (entry?.total ?? 0);
      const covered = done + (entry?.covered ?? 0);

      return [skillId, total > 0 ? Math.min(1, Math.max(0, covered / total)) : 1];
    }),
  );
}

/** The bases the learner chose to skip (see `BaseChoice`). */
function listSkippedBases(input: BuildPlanInput): Set<string> {
  const choices = getBaseChoices({ bases: input.bases ?? [], choices: getKeptBaseChoices(input) });

  return new Set([...choices].flatMap(([skillId, choice]) => (choice === "skip" ? [skillId] : [])));
}

/**
 * The share of the goal the plan covers before its deadline (see `PlanFeasibility.coveredShare`): each skill counts what it's worth
 * (its share of the exam, else its weight) times the share of its minutes that fit, including
 * what fits of a skill the plan can't finish, so more time always shows more.
 */
export function getCoverage({
  built,
  examSubjects,
  sized,
}: {
  built: BuiltPlan;
  examSubjects: readonly ExamSubjectShare[] | null;
  sized: SizedPlanInput;
}): { coveredShare: number; measure: "exam" | "goal"; skillFits: Map<string, number> } {
  const { input } = sized;
  const skipped = new Set(input.settings.skippedAreas);
  const skippedBases = listSkippedBases(input);

  // What the learner took out (an area, a base they skip) isn't part of what's measured.
  const skills = input.graph.skills
    .map((skill) => ({
      area: getSkillArea({ graph: input.graph, skill }),
      skillId: skill.skillId,
      weight: skill.weight ?? 1,
    }))
    .filter((skill) => !skipped.has(skill.area) && !skippedBases.has(skill.skillId));

  const examWorth = examSubjects ? getExamWorth({ examSubjects, skills }) : null;
  const skillFits = getSkillFits({ built, doneMinutes: sized.doneMinutes, input, skills });

  const worthOf = (skill: CoveredSkill) =>
    examWorth ? (examWorth.get(skill.skillId) ?? 0) : skill.weight;

  const total = skills.reduce((sum, skill) => sum + worthOf(skill), 0);

  const covered = skills.reduce(
    (sum, skill) => sum + worthOf(skill) * (skillFits.get(skill.skillId) ?? 1),
    0,
  );

  return {
    coveredShare: total === 0 ? 1 : covered / total,
    measure: examWorth ? "exam" : "goal",
    skillFits,
  };
}
