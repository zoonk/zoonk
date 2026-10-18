import {
  type MockResult,
  type PreparationComponents,
  type PreparationSkill,
  type PreparationStage,
  type PreparationTestKind,
  type UnseenAnswer,
  getPreparationComponents,
  getPreparationStage,
  getPreparationValue,
  sumImportance,
} from "./preparation-math";

/** What preparation reads for one goal, as of one moment. */
type PreparationInput = {
  answers: readonly UnseenAnswer[];
  asOf: Date;
  mocks: readonly MockResult[];
  /** Exam shares by section; absent when the goal has no usable exam shares. */
  sectionWeights?: ReadonlyMap<string, number> | null;
  skills: readonly PreparationSkill[];
  testKind?: PreparationTestKind;
  testPlusRequired?: boolean;
};

/** Right answers of those given to questions never seen before. */
type MasteryEvidence = { answered: number; correct: number };

/**
 * Preparation in one section of the goal's skill graph (an exam's "Matemática", as the planner
 * and the syllabus's subjects name it). `weight` is its share of the exam, or of the goal's
 * importance when no exam shares are available: the sections' preparations, each counting by its
 * weight, are the goal's own.
 */
export type SectionPreparation = {
  /**
   * The answers that say how well the section is known, once it has the few mastery needs (see
   * `getPreparationComponents`). Null before: its preparation counts no mastery yet.
   */
  mastery: MasteryEvidence | null;
  preparation: number;
  section: string;
  weight: number;
};

/** A goal's preparation as of one moment: its number, its four parts and each of its sections. */
type MeasuredPreparation = {
  /**
   * The four parts behind the number. Mastery reads the answers in the sections that have enough
   * of them, the ones whose preparation counts it, so it shows only where the number does.
   */
  components: PreparationComponents;
  sections: SectionPreparation[];
  stage: PreparationStage;
  value: number;
};

/** Exam shares do not grow with a subject's number or difficulty of skills. */
function getSectionWeights({
  groups,
  sectionWeights,
}: {
  groups: ReadonlyMap<string | null, readonly PreparationSkill[]>;
  sectionWeights: PreparationInput["sectionWeights"];
}): Map<string | null, number> {
  const hasShares = Boolean(sectionWeights?.size);

  const parts = [...groups].map(([section, skills]) => {
    const share = section === null ? 0 : (sectionWeights?.get(section) ?? 0);
    return { section, weight: hasShares ? share : sumImportance(skills) };
  });

  const total = parts.reduce((sum, part) => sum + part.weight, 0);

  if (total > 0) {
    return new Map(parts.map(({ section, weight }) => [section, weight / total]));
  }

  const fallback = hasShares ? 0 : 1 / parts.length;
  return new Map(parts.map(({ section }) => [section, fallback]));
}

/**
 * Measures a goal's preparation as of `asOf` (today's, or the week's start for its gain) the way
 * its subjects read: each section of its skill graph by the goal's rule (see
 * `getPreparationValue`) on its own skills and answers, with the goal's tests, which span every
 * section; the goal's number is theirs together, each counting by its exam share when available,
 * otherwise its share of the goal's importance. Sections outside an available exam share map
 * count as zero; included shares are normalized, so set-aside subjects do not dilute the goal.
 * So the whole sits within its contributing parts, or is zero when none contributes: a few
 * answers in each subject, too few to count mastery in any, don't count it for the whole either. Without exam shares, skills with
 * no section count as one more part, which no subject shows; a goal whose graph names no sections
 * is that one part.
 */
export function measurePreparation(input: PreparationInput): MeasuredPreparation {
  const grouped = Map.groupBy(input.skills, (skill) => skill.section ?? null);
  const weights = getSectionWeights({ groups: grouped, sectionWeights: input.sectionWeights });
  const groups = [...grouped];

  const parts = groups.map(([section, skills]) => {
    const skillIds = new Set(skills.map((skill) => skill.skillId));
    const answers = input.answers.filter((answer) => skillIds.has(answer.skillId));
    const components = getPreparationComponents({ ...input, answers, skills });

    return {
      answers,
      components,
      preparation: getPreparationValue(components),
      section,
      weight: weights.get(section) ?? 0,
    };
  });

  const counted = parts.filter((part) => part.weight > 0 && part.components.mastery.value !== null);

  const components = getPreparationComponents({
    ...input,
    answers: counted.flatMap((part) => part.answers),
  });

  const value = parts.reduce((sum, part) => sum + part.preparation * part.weight, 0);

  return {
    components,
    sections: parts.flatMap(({ components: { mastery }, preparation, section, weight }) =>
      section === null
        ? []
        : [
            {
              mastery:
                mastery.value === null
                  ? null
                  : { answered: mastery.answered, correct: mastery.correct },
              preparation,
              section,
              weight,
            },
          ],
    ),
    stage: getPreparationStage({ components, value }),
    value,
  };
}

/** The sections a subject gathers (`areas`, such as ENEM's languages and its foreign language). */
function getOwnSections({
  areas,
  sections,
}: {
  areas: readonly string[];
  sections: readonly SectionPreparation[];
}): SectionPreparation[] {
  return sections.filter((section) => areas.includes(section.section));
}

/**
 * A subject's preparation from the sections it gathers: their preparations, each counting by its
 * weight. Null when the goal measures none of them.
 */
export function getSubjectPreparation(input: {
  areas: readonly string[];
  sections: readonly SectionPreparation[];
}): number | null {
  const own = getOwnSections(input);

  if (own.length === 0) {
    return null;
  }

  const weight = own.reduce((sum, section) => sum + section.weight, 0);

  if (weight === 0) {
    return own.reduce((sum, section) => sum + section.preparation, 0) / own.length;
  }

  return own.reduce((sum, section) => sum + section.preparation * section.weight, 0) / weight;
}

/**
 * The answers that say how well a subject is known: those of its sections with enough to count
 * mastery. Null while none has: its preparation counts no mastery yet.
 */
export function getSubjectMastery(input: {
  areas: readonly string[];
  sections: readonly SectionPreparation[];
}): MasteryEvidence | null {
  const counted = getOwnSections(input).flatMap((section) =>
    section.mastery ? [section.mastery] : [],
  );

  if (counted.length === 0) {
    return null;
  }

  return {
    answered: counted.reduce((sum, mastery) => sum + mastery.answered, 0),
    correct: counted.reduce((sum, mastery) => sum + mastery.correct, 0),
  };
}
