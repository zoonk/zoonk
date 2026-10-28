import { MIN_CHECKPOINT_QUESTIONS } from "../../checkpoints/checkpoint-rules";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { spreadAreaQuestions } from "../../plans/focus-test/focus-test-rules";
import { matchAreasToSubjects } from "../../view-models/syllabus/_utils/match-areas";
import {
  PLACEMENT_MOCK_LENGTHS,
  type PlacementMockLength,
  type PlacementMockOptionView,
} from "./mock-contract";
import { planWholeExam } from "./mock-option-plan";
import { estimateMockMinutes, getObjectiveSubjects } from "./mock-options";
import { type MockCandidate, type MockPlan, getMockDays, getPace, outlineMock } from "./mock-plan";
import { isMockShort } from "./mock-shortfall";
import { getSubjectPace } from "./subject-sections";
import { isWrittenSubject } from "./written-subject";

const LENGTH_MINUTES: Record<PlacementMockLength, number> = { long: 60, medium: 30, short: 15 };

const MIN_PER_AREA: Record<PlacementMockLength, number> = { long: 2, medium: 1, short: 0 };

type PlacementArea = { name: string | null; shortName: string | null; pace: number; worth: number };

type AreaQuestions = { area: PlacementArea; questions: number };

export type PlacementMockOption = PlacementMockOptionView & { counts: AreaQuestions[] };

function getPlacedSubjects({
  goalAreas,
  structure,
}: {
  goalAreas: readonly string[];
  structure: ExamStructure;
}) {
  if (goalAreas.length > 0) {
    return getObjectiveSubjects({ goalAreas, structure });
  }

  return structure.subjects.filter((subject) => !isWrittenSubject({ structure, subject }));
}

function getAreas({
  goalAreas,
  structure,
}: {
  goalAreas: readonly string[];
  structure: ExamStructure | null;
}): PlacementArea[] {
  const pace = getPace(structure);
  const subjects = structure ? getPlacedSubjects({ goalAreas, structure }) : [];

  if (structure && subjects.length > 0) {
    return subjects.map((subject) => ({
      name: subject.name,
      pace: getSubjectPace({ structure, subject }),
      shortName: subject.shortName ?? null,
      worth: getSubjectQuestions({ structure, subject }) ?? 1,
    }));
  }

  return goalAreas.length > 0
    ? goalAreas.map((area) => ({ name: area, pace, shortName: null, worth: 1 }))
    : [{ name: null, pace, shortName: null, worth: 1 }];
}

function getWholeExamQuestions(structure: ExamStructure | null): number {
  return getMockDays(structure).reduce<number>(
    (sum, day) =>
      sum +
      outlineMock({ day, fullLength: true, structure }).sections.reduce(
        (total, section) => total + section.questions,
        0,
      ),
    0,
  );
}

function allocate({
  areas,
  minPerArea,
  questions,
}: {
  areas: readonly PlacementArea[];
  minPerArea: number;
  questions: number;
}): AreaQuestions[] {
  const ranked = areas
    .map((area, index) => ({ area, index }))
    .toSorted((first, second) => second.area.worth - first.area.worth || first.index - second.index)
    .map((entry) => entry.index);

  if (questions < areas.length) {
    const asked = new Set(ranked.slice(0, questions));
    return areas.map((area, index) => ({ area, questions: asked.has(index) ? 1 : 0 }));
  }

  const base = Math.max(1, Math.min(minPerArea, Math.floor(questions / areas.length)));
  const rest = questions - base * areas.length;
  const worth = areas.reduce((sum, area) => sum + area.worth, 0);
  const shares = areas.map((area) => (rest * area.worth) / worth);
  const floors = shares.map((share) => Math.floor(share));
  const left = rest - floors.reduce((sum, floor) => sum + floor, 0);

  const extra = new Set(
    ranked
      .toSorted(
        (first, second) =>
          (shares[second] ?? 0) -
          (floors[second] ?? 0) -
          ((shares[first] ?? 0) - (floors[first] ?? 0)),
      )
      .slice(0, left),
  );

  return areas.map((area, index) => ({
    area,
    questions: base + (floors[index] ?? 0) + (extra.has(index) ? 1 : 0),
  }));
}

function toOption({
  areas,
  length,
  measuredPace,
  most,
  sizingPace,
}: {
  areas: readonly PlacementArea[];
  length: PlacementMockLength;
  measuredPace: number | null;
  most: number;
  sizingPace: number;
}): PlacementMockOption {
  const minimum = Math.max(MIN_CHECKPOINT_QUESTIONS, MIN_PER_AREA[length] * areas.length);
  const fitting = Math.round(LENGTH_MINUTES[length] / sizingPace);
  const questions = Math.min(most, Math.max(minimum, fitting));

  const counts = allocate({ areas, minPerArea: MIN_PER_AREA[length], questions });
  const asked = counts.filter((entry) => entry.questions > 0);

  const minutes = [...Map.groupBy(asked, (entry) => entry.area.pace)].reduce(
    (sum, [pace, group]) =>
      sum +
      Math.max(1, Math.round(pace * group.reduce((total, entry) => total + entry.questions, 0))),
    0,
  );

  return {
    areas: asked.flatMap((entry) => (entry.area.name ? [entry.area.name] : [])),
    counts,
    coversAllAreas: asked.length === areas.length,
    estimatedMinutes: estimateMockMinutes({ minutes, pace: measuredPace, questions }),
    length,
    minutes,
    questions,
  };
}

export function listPlacementMockOptions({
  goalAreas,
  pace,
  structure,
}: {
  goalAreas: readonly string[];
  pace: number | null;
  structure: ExamStructure | null;
}): PlacementMockOption[] {
  const areas = getAreas({ goalAreas, structure });
  const most = getWholeExamQuestions(structure);
  const worth = areas.reduce((sum, area) => sum + area.worth, 0);
  const examPace = areas.reduce((sum, area) => sum + area.pace * area.worth, 0) / worth;

  const options = PLACEMENT_MOCK_LENGTHS.map((length) =>
    toOption({ areas, length, measuredPace: pace, most, sizingPace: pace ?? examPace }),
  ).filter((option) => option.questions > 0);

  return options.filter((option, index) =>
    options.slice(index + 1).every((next) => next.questions !== option.questions),
  );
}

export function toPlacementOptionView(option: PlacementMockOption): PlacementMockOptionView {
  return {
    areas: option.areas,
    coversAllAreas: option.coversAllAreas,
    estimatedMinutes: option.estimatedMinutes,
    length: option.length,
    minutes: option.minutes,
    questions: option.questions,
  };
}

export function getRecommendedPlacementLength(
  options: readonly PlacementMockOption[],
): PlacementMockLength | null {
  return options[0]?.length ?? null;
}

export type PlacementSkill = { area: string; skillId: string };

type Picked = { missing: string[]; picks: MockCandidate[]; taken: ReadonlySet<string> };

function pickArea({
  candidates,
  entry,
  picked,
  skillIds,
}: {
  candidates: readonly MockCandidate[];
  entry: AreaQuestions;
  picked: Picked;
  skillIds: readonly string[];
}): Picked {
  const { name } = entry.area;

  const spread = spreadAreaQuestions({ count: entry.questions, skillIds });

  return spread.reduce<Picked>((state, skillId) => {
    const free = (id: string) =>
      candidates.find(
        (candidate) => candidate.skillId === id && !state.taken.has(candidate.itemId),
      );

    const position = skillIds.indexOf(skillId);
    const own = free(skillId);

    const nearest =
      own ??
      skillIds
        .map((id, index) => ({ distance: Math.abs(index - position), id }))
        .toSorted((first, second) => first.distance - second.distance)
        .map(({ id }) => free(id))
        .find((candidate) => candidate !== undefined);

    return {
      missing: own ? state.missing : [...state.missing, skillId],
      picks: nearest ? [...state.picks, { ...nearest, area: name ?? nearest.area }] : state.picks,
      taken: nearest ? new Set([...state.taken, nearest.itemId]) : state.taken,
    };
  }, picked);
}

export function planPlacementMock({
  candidates,
  option,
  skills,
  structure,
}: {
  candidates: readonly MockCandidate[];
  option: PlacementMockOption;
  skills: readonly PlacementSkill[];
  structure: ExamStructure | null;
}): { missingSkillIds: string[]; plan: MockPlan } {
  const subjects = option.counts.map((entry) => entry.area.name);

  const owners = matchAreasToSubjects({
    areas: [...new Set(skills.map((skill) => skill.area))],
    subjects: option.counts.map(({ area }) => ({
      name: area.name ?? "",
      shortName: area.shortName,
    })),
  });

  const skillsOf = (index: number) =>
    skills
      .filter((skill) => subjects[index] === null || owners.get(skill.area) === index)
      .map((skill) => skill.skillId);

  const picked = option.counts.reduce<Picked>(
    (state, entry, index) =>
      pickArea({ candidates, entry, picked: state, skillIds: skillsOf(index) }),
    { missing: [], picks: [], taken: new Set() },
  );

  const plan = planWholeExam({ candidates: picked.picks, structure });

  return { missingSkillIds: picked.missing, plan: { ...plan, fullLength: false } };
}

export function getPlacementQuestionsShortfall({
  missingSkillIds,
  option,
  planned,
}: {
  missingSkillIds: readonly string[];
  option: { questions: number };
  planned: number;
}): { questionsPerSkill: number; skillIds: string[] } | null {
  if (!isMockShort({ option, planned }) || missingSkillIds.length === 0) {
    return null;
  }

  const places = Map.groupBy(missingSkillIds, (skillId) => skillId);

  return {
    questionsPerSkill: Math.max(...[...places.values()].map((group) => group.length)),
    skillIds: [...places.keys()],
  };
}
