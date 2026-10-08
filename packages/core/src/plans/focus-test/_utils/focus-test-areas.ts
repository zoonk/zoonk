import { getSubjectShare } from "../../../exams/map/exam-map";
import { isWrittenSubject } from "../../../exams/mocks/written-subject";
import { type ExamStructure } from "../../../library/exams/blueprint-contract";
import {
  followsNotice,
  matchAreasToSubjects,
} from "../../../view-models/syllabus/_utils/match-areas";
import { getSkillArea } from "../../planner/graph-areas";
import { type PlanGraph, type PlanSettings } from "../../planner/plan-state";
import { type FocusTestArea } from "../focus-test-rules";

type AreaSkills = { name: string; skillIds: string[]; weight: number };

/** The plan's areas in teaching order with their skills, the ones the learner took out left out. */
function groupAreas({ graph, settings }: { graph: PlanGraph; settings: PlanSettings }) {
  const skipped = new Set(settings.skippedAreas);

  const areas = graph.skills.reduce((byArea, skill) => {
    const name = getSkillArea({ graph, skill });
    const area = byArea.get(name) ?? { name, skillIds: [], weight: 0 };

    return byArea.set(name, {
      ...area,
      skillIds: [...area.skillIds, skill.skillId],
      weight: area.weight + (skill.weight ?? 1),
    });
  }, new Map<string, AreaSkills>());

  return [...areas.values()].filter((area) => area.name && !skipped.has(area.name));
}

/**
 * An exam's areas the test can ask about, each worth its subject's share of the exam split among
 * the subject's areas (or, for a notice that gives no subject its share, the weight the plan gives
 * the area's skills), and named as learners call its subject: only areas of the notice's subjects
 * (the plan's own extras, such as exam strategy, aren't on the exam) and never a written test's (a
 * discursive test has no questions to choose between). Null when the plan doesn't follow the
 * notice's subjects.
 */
function getExamAreas({
  areas,
  structure,
}: {
  areas: readonly AreaSkills[];
  structure: ExamStructure;
}): FocusTestArea[] | null {
  const names = areas.map((area) => area.name);

  const matches = matchAreasToSubjects({
    areas: names,
    subjects: structure.subjects.map((subject) => subject.name),
  });

  if (!followsNotice({ areas: names, matches })) {
    return null;
  }

  const shares = structure.subjects.map((subject) => getSubjectShare({ structure, subject }));
  const known = shares.filter((share) => share !== null);

  const fallback =
    known.length > 0 ? known.reduce((sum, share) => sum + share, 0) / known.length : 1;

  const examAreas = areas.flatMap((area) => {
    const index = matches.get(area.name);
    const subject = index === undefined ? null : structure.subjects[index];

    if (index === undefined || !subject || isWrittenSubject({ structure, subject })) {
      return [];
    }

    return [{ area, index, subject }];
  });

  const totalWeight = examAreas.reduce((sum, { area }) => sum + area.weight, 0);

  return examAreas.map(({ area, index, subject }) => {
    const siblings = names.filter((name) => matches.get(name) === index).length;

    const worth =
      known.length > 0
        ? (shares[index] ?? fallback) / Math.max(1, siblings)
        : area.weight / Math.max(1, totalWeight);

    return {
      label: subject.shortName ?? area.name,
      name: area.name,
      skillIds: area.skillIds,
      worth,
    };
  });
}

/**
 * The plan's areas the focus test can ask about, in teaching order, each with its skills and what
 * it's worth to the goal: an exam's share of its questions and points (see `getExamAreas`), or the
 * weight of the area's skills for any other goal.
 */
export function getFocusTestAreas({
  graph,
  settings,
  structure,
}: {
  graph: PlanGraph;
  settings: PlanSettings;
  structure: ExamStructure | null;
}): FocusTestArea[] {
  const areas = groupAreas({ graph, settings });
  const examAreas = structure ? getExamAreas({ areas, structure }) : null;

  if (examAreas) {
    return examAreas;
  }

  const total = areas.reduce((sum, area) => sum + area.weight, 0);

  return areas.map((area) => ({
    label: area.name,
    name: area.name,
    skillIds: area.skillIds,
    worth: total > 0 ? area.weight / total : 0,
  }));
}
