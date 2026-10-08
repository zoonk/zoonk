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
import {
  estimateMockMinutes,
  getObjectiveSubjects,
  getSubjectPace,
  subjectName,
} from "./mock-options";
import { type MockCandidate, type MockPlan, getMockDays, getPace, outlineMock } from "./mock-plan";
import { isMockShort } from "./mock-shortfall";
import { isWrittenSubject } from "./written-subject";

/**
 * A diagnostic mock taken as placement: a few of the exam's questions on every subject, spread
 * over each subject's topics from the basics to the hardest, so its answers say where the plan
 * starts in each. The learner picks how long: about a quarter of an hour, half an hour or an hour,
 * at learners' real pace. A longer one asks more of each subject and sets a finer starting point.
 */
const LENGTH_MINUTES: Record<PlacementMockLength, number> = { long: 60, medium: 30, short: 15 };

/**
 * The fewest questions each length asks of every subject: a quick check may leave the subjects
 * worth least to the first days' questions when its time doesn't reach them, half an hour asks
 * each at least once, and an hour at least twice, however many subjects the notice has.
 */
const MIN_PER_AREA: Record<PlacementMockLength, number> = { long: 2, medium: 1, short: 0 };

/**
 * A part of the exam the mock places the learner in: one of the notice's subjects, or for a plan
 * whose areas aren't the notice's, one of its areas.
 */
type PlacementArea = {
  /** Its full name, which the plan's areas are matched to ("Matemática e suas Tecnologias"). */
  fullName: string | null;
  /** The name its questions and the exam's sections go by ("Matemática"); null for the whole. */
  name: string | null;
  /** Minutes per question at the exam's pace, which the mock's clock gives. */
  pace: number;
  /** Its share of the exam: its questions on the notice, or one each when the notice doesn't say. */
  worth: number;
};

type AreaQuestions = { area: PlacementArea; questions: number };

/** A diagnostic mock's length, with how many questions it asks of each subject (some none). */
export type PlacementMockOption = PlacementMockOptionView & { counts: AreaQuestions[] };

/** The notice's objective subjects the plan studies; all of them before the plan has areas. */
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
      fullName: subject.name,
      name: subjectName(subject),
      pace: getSubjectPace({ structure, subject }),
      worth: getSubjectQuestions({ structure, subject }) ?? 1,
    }));
  }

  // A plan of its own areas places each one; before the plan has any, the whole exam is one part.
  return goalAreas.length > 0
    ? goalAreas.map((area) => ({ fullName: area, name: area, pace, worth: 1 }))
    : [{ fullName: null, name: null, pace, worth: 1 }];
}

/** The most a diagnostic mock asks: the whole exam's objective questions. */
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

/**
 * Shares the mock's questions among the subjects: every subject the same few first (at most
 * `minPerArea`), the rest by what each is worth, largest remainders first. With fewer questions
 * than subjects, the ones worth most get one each.
 */
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

  // Subjects of one exam section share its pace, and its clock rounds once, as the mock's does.
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

/**
 * The lengths a diagnostic mock comes in for this exam, shortest first, each with its questions
 * and time: sized by learners' real pace on the exam's mocks (`pace`), or the exam's own until
 * that's known, never more than the whole exam. Two lengths that would ask as many questions are
 * one, under the longer one's name.
 */
export function listPlacementMockOptions({
  goalAreas,
  pace,
  structure,
}: {
  /** The plan's areas; empty while the plan is still being drawn. */
  goalAreas: readonly string[];
  /** Learners' minutes per question on the exam's mocks (see `loadMockPace`), when known. */
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

/** A length as the learner picks it, without its per-subject counts. */
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

/**
 * The length suggested first: the quick check (about a quarter of an hour), or the shortest the
 * exam has. It's enough to start the plan, whose first days keep placing the learner; every length
 * shows its time, and the learner picks.
 */
export function getRecommendedPlacementLength(
  options: readonly PlacementMockOption[],
): PlacementMockLength | null {
  return options[0]?.length ?? null;
}

/** A skill of the plan's graph, in the graph's order (its basics first), with its area. */
export type PlacementSkill = { area: string; skillId: string };

type Picked = { missing: string[]; picks: MockCandidate[]; taken: ReadonlySet<string> };

/**
 * One subject's questions, one on each of its spread topics (see `spreadAreaQuestions`): the
 * topic's own question when the bank has one the learner hasn't answered, else the nearest topic's,
 * so the mock keeps its size while the topic is `missing`.
 */
function pickArea({
  candidates,
  entry,
  picked,
  skillIds,
}: {
  candidates: readonly MockCandidate[];
  entry: AreaQuestions;
  picked: Picked;
  /** The subject's topics in the plan's order. */
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

/**
 * Plans a diagnostic mock from the questions the learner never answered on the plan's skills: each
 * subject's share spread over its topics in the plan's order, then sat as the exam sits them, day
 * by day and section by section, at the exam's pace. `missingSkillIds`: the topic of each place
 * that had no question of its own (a topic twice for two such places), which writing some fills.
 */
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
  const subjects = option.counts.map((entry) => entry.area.fullName);

  // Each plan area belongs to its best-matching subject alone: "Direito Civil" never to
  // "Direito Processual Civil".
  const owners = matchAreasToSubjects({
    areas: [...new Set(skills.map((skill) => skill.area))],
    subjects: subjects.map((subject) => subject ?? ""),
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

/**
 * What to write before a diagnostic mock can start when the bank is short of its questions (see
 * `isMockShort`): for each topic with places the bank had no question for, that many. Null when
 * the bank holds enough, or nothing would fill it (the mock starts with what there is).
 */
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
