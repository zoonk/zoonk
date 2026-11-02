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

type PreparationInput = {
  answers: readonly UnseenAnswer[];
  asOf: Date;
  mocks: readonly MockResult[];
  sectionWeights?: ReadonlyMap<string, number> | null;
  skills: readonly PreparationSkill[];
  testKind?: PreparationTestKind;
  testPlusRequired?: boolean;
};

type MasteryEvidence = { answered: number; correct: number };

export type SectionPreparation = {
  mastery: MasteryEvidence | null;
  preparation: number;
  section: string;
  weight: number;
};

type MeasuredPreparation = {
  components: PreparationComponents;
  sections: SectionPreparation[];
  stage: PreparationStage;
  value: number;
};

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

function getOwnSections({
  areas,
  sections,
}: {
  areas: readonly string[];
  sections: readonly SectionPreparation[];
}): SectionPreparation[] {
  return sections.filter((section) => areas.includes(section.section));
}

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
