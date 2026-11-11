import { isDeepStrictEqual } from "node:util";
import { getSubjectShareFallback } from "../../exams/_utils/subject-share-fallback";
import { type ExamPicks, toChosenStructure } from "../../exams/choices/exam-choices";
import { getPaperKind, isWrittenSubject } from "../../exams/mocks/written-subject";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { isQualifyingSubject, listPlanShares } from "../../library/exams/subject-shares";
import { getSkillArea, getWrittenTestAreas } from "../../plans/planner/graph-areas";
import { type PlanGraph, type PlanState } from "../../plans/planner/plan-state";
import { followsNotice, matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import { type UncheckedPart } from "./focus-test-contract";

/** A subject of the exam's notice with the plan areas that study it; a plan without one lists its own areas. */
export type TestSubject = {
  areas: string[];
  key: string;
  minimumScore: boolean;
  name: string;
  /** Null when quick questions can check it. */
  part: UncheckedPart | null;
  /** Its planning share of the exam, 0 to 1. */
  share: number;
  shortName: string | null;
};

type PlanArea = { name: string; skillIds: string[]; weight: number };

function listPlanAreas({
  graph,
  skippedAreas,
}: {
  graph: PlanGraph;
  skippedAreas: readonly string[];
}): PlanArea[] {
  const skipped = new Set(skippedAreas);

  const areas = graph.skills.reduce((byName, skill) => {
    const name = getSkillArea({ graph, skill });
    const area = byName.get(name) ?? { name, skillIds: [], weight: 0 };

    return byName.set(name, {
      name,
      skillIds: [...area.skillIds, skill.skillId],
      weight: area.weight + (skill.weight ?? 1),
    });
  }, new Map<string, PlanArea>());

  return [...areas.values()].filter((area) => area.name && !skipped.has(area.name));
}

function isOnlyListened({
  listeningSkillIds,
  skillIds,
}: {
  listeningSkillIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): boolean {
  return skillIds.length > 0 && skillIds.every((skillId) => listeningSkillIds.has(skillId));
}

function listNoticeSubjects({
  areas,
  listeningSkillIds,
  structure,
}: {
  areas: readonly PlanArea[];
  listeningSkillIds: ReadonlySet<string>;
  structure: ExamStructure;
}): TestSubject[] | null {
  const names = areas.map((area) => area.name);
  const matches = matchAreasToSubjects({ areas: names, subjects: structure.subjects });

  if (!followsNotice({ areas: names, matches })) {
    return null;
  }

  const shares = listPlanShares(structure);
  const fallback = getSubjectShareFallback(shares);

  return structure.subjects.flatMap((subject, index) => {
    const own = areas.filter((area) => matches.get(area.name) === index);
    const skillIds = own.flatMap((area) => area.skillIds);

    if (own.length === 0) {
      return [];
    }

    const paper =
      (isWrittenSubject({ structure, subject }) ? "written" : null) ??
      getPaperKind({ structure, subject }) ??
      (isOnlyListened({ listeningSkillIds, skillIds }) ? "listening" : null);

    return [
      {
        areas: own.map((area) => area.name),
        key: subject.name,
        minimumScore: isQualifyingSubject({ structure, subject }),
        name: subject.name,
        part: paper,
        share: shares[index] ?? fallback,
        shortName: subject.shortName ?? null,
      },
    ];
  });
}

function listAreaSubjects({
  areas,
  graph,
  listeningSkillIds,
}: {
  areas: readonly PlanArea[];
  graph: PlanGraph;
  listeningSkillIds: ReadonlySet<string>;
}): TestSubject[] {
  const written = getWrittenTestAreas(graph);
  const total = areas.reduce((sum, area) => sum + area.weight, 0);

  return areas.map((area) => ({
    areas: [area.name],
    key: area.name,
    minimumScore: false,
    name: area.name,
    part:
      (written.has(area.name) ? "written" : null) ??
      (isOnlyListened({ listeningSkillIds, skillIds: area.skillIds }) ? "listening" : null),
    share: total > 0 ? area.weight / total : 0,
    shortName: null,
  }));
}

/** Each graph skill's plan area; a skill that names none takes its phase's. */
export function mapSkillAreas(graph: PlanGraph): Map<string, string> {
  return new Map(graph.skills.map((skill) => [skill.skillId, getSkillArea({ graph, skill })]));
}

function readSubjectInputs({ graph, settings }: PlanState) {
  return {
    areas: mapSkillAreas(graph),
    examChoices: settings.examChoices,
    examSubjects: settings.examSubjects,
    skippedAreas: settings.skippedAreas,
  };
}

/** Whether a plan write changes what `listTestSubjects` reads from the plan. */
export function changesTestSubjects({ after, before }: { after: PlanState; before: PlanState }) {
  return !isDeepStrictEqual(readSubjectInputs(before), readSubjectInputs(after));
}

/** In the notice's order, or the plan's when it doesn't follow a notice; areas the learner left out aren't listed. */
export function listTestSubjects({
  graph,
  listeningSkillIds,
  settings,
  structure,
}: {
  graph: PlanGraph;
  /** The skills the exam practices only with recordings, which quick questions can't check. */
  listeningSkillIds: ReadonlySet<string>;
  settings: ExamPicks & { skippedAreas: readonly string[] };
  structure: ExamStructure | null;
}): TestSubject[] {
  const areas = listPlanAreas({ graph, skippedAreas: settings.skippedAreas });

  const noticed = structure
    ? listNoticeSubjects({
        areas,
        listeningSkillIds,
        structure: toChosenStructure({ picks: settings, structure }),
      })
    : null;

  return noticed ?? listAreaSubjects({ areas, graph, listeningSkillIds });
}
