import { getSubjectShareFallback } from "../../exams/_utils/subject-share-fallback";
import { getSubjectShare } from "../../exams/map/exam-map";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { followsNotice, matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { getSkillArea } from "../planner/graph-areas";
import { type PlanGraph } from "../planner/plan-state";
import { type ExamSubjectShare } from "../planner/selected-coverage";

const MIN_STATED_SHARE = 1 / 2;

type SubjectShare = ExamSubjectShare & { stated: boolean };

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

  const matches = matchAreasToSubjects({ areas, subjects: structure.subjects });

  if (!followsNotice({ areas, matches })) {
    return null;
  }

  const shares = structure.subjects.map((subject) => getSubjectShare({ structure, subject }));
  const fallback = getSubjectShareFallback(shares);

  return structure.subjects
    .map((_, index) => ({
      areas: areas.filter((area) => matches.get(area) === index),
      share: shares[index] ?? fallback,
      stated: shares[index] !== null && shares[index] !== undefined,
    }))
    .filter((subject) => subject.areas.length > 0);
}
