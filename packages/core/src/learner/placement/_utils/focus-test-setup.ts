import "server-only";
import { createHash } from "node:crypto";
import { type ExamBlueprint, type Goal } from "@zoonk/db";
import { toListeningExam } from "../../../exams/listening/listening-exam";
import { getListeningSkillIds } from "../../../exams/listening/listening-skills";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import { getExamChoiceFormats } from "../../../library/exams/exam-choice-format";
import { readNoticeFormats } from "../../../library/exams/notice-formats";
import { readBlueprintContent } from "../../../library/exams/save-exam-blueprint";
import { listFocusedSkillIds } from "../../../plans/planner/focus-targets";
import { type PlanGraph, type PlanSettings } from "../../../plans/planner/plan-state";
import { type GoalSkillNode } from "../../_utils/goal-skill-graph";
import { type TestProgress, getAreaOrder, getTestProgress } from "../focus-test-progress";
import { type FocusTestRecord, readFocusTestRecord } from "../focus-test-state";
import { type TestSubject, listTestSubjects, mapSkillAreas } from "../focus-test-subjects";
import { getKnownSubjects, getOwnLevel, isLevelMeasured } from "../placement-contract";
import { isOwnMaterialTest } from "../placement-material";
import { confirmsInWriting, getPlacementQuickFormat } from "../placement-quick-format";
import { type TestSkillAnswers } from "./placement-evidence";

type TestGoal = Goal & { examBlueprint: ExamBlueprint | null };

export type TestSetup = {
  /** Each graph skill's plan area, which a skill with no area of its own takes from its phase. */
  areaOf: ReadonlyMap<string, string>;
  goal: TestGoal;
  inputsKey: string;
  plan: { coveredShare: number | null; focusAreas: string[]; id: string };
  record: FocusTestRecord | null;
  subjects: TestSubject[];
};

type SummaryInputs = { goal: TestGoal; graph: PlanGraph; settings: PlanSettings };

function listGoalSubjects({
  goal,
  graph,
  settings,
  structure,
}: SummaryInputs & { structure: ExamStructure | null }): TestSubject[] {
  return listTestSubjects({
    graph,
    listeningSkillIds: getListeningSkillIds({ exam: toListeningExam(goal), graph }),
    settings,
    structure,
  });
}

/**
 * What the placement engine counts a Focus test summary from besides the answers and questions, as
 * one comparable key: what `loadGoalExam` and the question filter derive from the goal, notice and plan.
 */
export function summaryInputsKey({ goal, graph, settings }: SummaryInputs): string {
  const blueprint = goal.examBlueprint;
  const structure = blueprint ? readBlueprintContent(blueprint).structure : null;

  const inputs = {
    areas: [...mapSkillAreas(graph)].toSorted(([first], [second]) => first.localeCompare(second)),
    choices: getExamChoiceFormats(structure).map(({ kind, options }) => ({ kind, options })),
    dated: goal.targetDate !== null,
    examBlueprintId: goal.examBlueprintId,
    focusAreas: settings.focusAreas,
    focusedSkillIds: [...listFocusedSkillIds({ graph, settings })].toSorted(),
    knownAreas: [...new Set(getKnownSubjects(goal))].toSorted(),
    level: getOwnLevel({ goal }),
    measured: isLevelMeasured(goal),
    ownMaterial: isOwnMaterialTest(blueprint),
    quickFormat: getPlacementQuickFormat(structure ?? readNoticeFormats(goal.details)),
    subjects: listGoalSubjects({ goal, graph, settings, structure }),
    typed: confirmsInWriting(goal),
  };

  return createHash("sha256").update(JSON.stringify(inputs)).digest("hex");
}

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
  plan: { coveredShare: number | null; id: string };
  settings: PlanSettings;
  structure: ExamStructure | null;
}): TestSetup | null {
  if (goal.kind !== "exam") {
    return null;
  }

  return {
    areaOf: mapSkillAreas(graph),
    goal,
    inputsKey: summaryInputsKey({ goal, graph, settings }),
    plan: { coveredShare: plan.coveredShare, focusAreas: settings.focusAreas, id: plan.id },
    record: readFocusTestRecord(goal),
    subjects: listGoalSubjects({ goal, graph, settings, structure }),
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
