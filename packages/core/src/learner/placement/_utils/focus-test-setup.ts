import "server-only";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { toListeningExam } from "../../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { type PlanGraph, type PlanSettings } from "../../../plans/planner/plan-state";
import { type GoalSkillNode } from "../../_utils/goal-skill-graph";
import { type TestProgress, getAreaOrder, getTestProgress } from "../focus-test-progress";
import { type FocusTestRecord, readFocusTestRecord } from "../focus-test-state";
import { type TestSubject, listTestSubjects, mapSkillAreas } from "../focus-test-subjects";
import { type TestSkillAnswers } from "./placement-evidence";

type TestGoal = Goal & { examBlueprint: ExamBlueprint | null };

export type TestSetup = {
  /** Each graph skill's plan area, which a skill with no area of its own takes from its phase. */
  areaOf: ReadonlyMap<string, string>;
  goal: TestGoal;
  plan: { coveredShare: number | null; focusAreas: string[]; id: string; version: number };
  record: FocusTestRecord | null;
  subjects: TestSubject[];
};

/** Only an exam goal's placement is a Focus test. */
export function toTestSetup({
  goal,
  graph,
  plan,
  settings,
  structure,
}: {
  goal: TestGoal;
  graph: PlanGraph;
  plan: { coveredShare: number | null; id: string; version: number };
  settings: PlanSettings;
  structure: ExamStructure | null;
}): TestSetup | null {
  if (goal.kind !== "exam") {
    return null;
  }

  return {
    areaOf: mapSkillAreas(graph),
    goal,
    plan: {
      coveredShare: plan.coveredShare,
      focusAreas: settings.focusAreas,
      id: plan.id,
      version: plan.version,
    },
    record: readFocusTestRecord(goal),
    subjects: listTestSubjects({
      graph,
      listeningSkillIds: getListeningSkillIds({ exam: toListeningExam(goal), graph }),
      settings,
      structure,
    }),
  };
}

/** When the test started, which is when a learner who passed placement by had its questions owed. */
export function getTestStart(setup: TestSetup | null): Date | null {
  const startedAt = setup?.record?.startedAt;
  return startedAt ? new Date(startedAt) : null;
}

export type TestTurn = {
  /** The plan areas the test asks now, in order. */
  areaOrder: string[];
  progress: TestProgress;
  setup: TestSetup;
  /** The plan's skills, each under its plan area, which is how the test walks them. */
  skills: GoalSkillNode[];
  /** The subject a plan skill's answers count for; null for a skill outside every subject. */
  subjectOf: (skillId: string) => string | null;
};

export function startTestTurn({
  setup,
  skills,
  testSkills,
  sittingOutcomes,
}: {
  setup: TestSetup;
  skills: readonly GoalSkillNode[];
  testSkills: readonly TestSkillAnswers[];
  sittingOutcomes: readonly ("correct" | "dontKnow" | "wrong")[];
}): TestTurn {
  const places = new Map(
    skills.map((skill) => {
      const area = setup.areaOf.get(skill.id) ?? skill.sectionTitle;
      const subject = setup.subjects.find((candidate) => area && candidate.areas.includes(area));

      return [skill.id, { area, subject: subject?.key ?? null }] as const;
    }),
  );

  const progress = getTestProgress({
    placeOf: (skillId) => places.get(skillId) ?? { area: null, subject: null },
    record: setup.record,
    sittingOutcomes,
    subjects: setup.subjects,
    testSkills,
  });

  return {
    areaOrder: getAreaOrder(progress.subjects),
    progress,
    setup,
    skills: skills.map((skill) => ({ ...skill, sectionTitle: places.get(skill.id)?.area ?? null })),
    subjectOf: (skillId) => places.get(skillId)?.subject ?? null,
  };
}

/** The subjects quick questions can check that still have something to ask; none left settles the test. */
export function countOpenSubjects({
  turn,
  undecided,
}: {
  turn: TestTurn;
  undecided: readonly { id: string }[];
}): number {
  const open = new Set(undecided.map((skill) => turn.subjectOf(skill.id)));

  return turn.progress.subjects.filter((subject) => subject.part === null && open.has(subject.key))
    .length;
}
