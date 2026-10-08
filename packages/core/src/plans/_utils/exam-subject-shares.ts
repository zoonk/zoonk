import { getSubjectShare } from "../../exams/map/exam-map";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { followsNotice, matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { getSkillArea } from "../planner/graph-areas";
import { type ExamSubjectShare } from "../planner/plan-feasibility";
import { type PlanGraph } from "../planner/plan-state";

function getAverage(values: readonly number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** At least half the subjects a plan teaches need a stated share before shares split its time. */
const MIN_STATED_SHARE = 1 / 2;

type SubjectShare = ExamSubjectShare & {
  /** The notice (or its latest edition) gives the share; false for an average stand-in. */
  stated: boolean;
};

/**
 * The notice's subjects the plan teaches, each with the plan's areas it gathers (matched as the
 * syllabus matches them) and its share of the exam: the notice's weight or share of questions. A
 * subject the notice gives neither, such as ENEM's essay next to its four 45-question areas,
 * counts as much as an average subject. Null when the plan doesn't follow the notice's subjects.
 */
export function getExamSubjectShares({
  graph,
  structure,
}: {
  graph: PlanGraph;
  structure: ExamStructure;
}): ExamSubjectShare[] | null {
  return (
    listSubjectShares({ graph, structure })?.map(({ areas, share }) => ({ areas, share })) ?? null
  );
}

/**
 * Each of the plan's areas' share of the exam, when the notice (or its latest edition) states
 * the share of at least half the subjects the plan teaches (ENEM's four 45-question areas, the OAB's
 * counts): a subject's share split evenly among its areas, a subject without one (ENEM's essay)
 * counting as an average one. Null otherwise: the skill graph's weights then say what each is
 * worth.
 */
export function getAreaShares({
  graph,
  structure,
}: {
  graph: PlanGraph;
  structure: ExamStructure;
}): Map<string, number> | null {
  const subjects = listSubjectShares({ graph, structure });
  const stated = subjects?.filter((subject) => subject.stated).length ?? 0;

  if (!subjects || subjects.length === 0 || stated < subjects.length * MIN_STATED_SHARE) {
    return null;
  }

  return new Map(
    subjects.flatMap((subject) =>
      subject.areas.map((area) => [area, subject.share / subject.areas.length] as const),
    ),
  );
}

function listSubjectShares({
  graph,
  structure,
}: {
  graph: PlanGraph;
  structure: ExamStructure;
}): SubjectShare[] | null {
  const areas = [...new Set(graph.skills.map((skill) => getSkillArea({ graph, skill })))].filter(
    (area) => area.length > 0,
  );

  const matches = matchAreasToSubjects({
    areas,
    subjects: structure.subjects.map((subject) => subject.name),
  });

  if (!followsNotice({ areas, matches })) {
    return null;
  }

  const shares = structure.subjects.map((subject) => getSubjectShare({ structure, subject }));
  const fallback = getAverage(shares.filter((share) => share !== null)) ?? 1;

  return structure.subjects
    .map((_, index) => ({
      areas: areas.filter((area) => matches.get(area) === index),
      share: shares[index] ?? fallback,
      stated: shares[index] !== null && shares[index] !== undefined,
    }))
    .filter((subject) => subject.areas.length > 0);
}
