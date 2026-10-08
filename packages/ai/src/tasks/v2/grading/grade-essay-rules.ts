import {
  type EnemInterventionElements,
  type EssayGrade,
  type EssayModelOutput,
  type EssayRubric,
} from "./grade-essay";
import { findEssayQuote } from "./grade-essay-quote";

/**
 * Official rubric facts, checked in Sep 2026:
 *
 * ENEM (INEP, "A redação do Enem 2025, cartilha do participante"): five
 * competencies (C1 formal written norm, C2 understanding the prompt and the
 * dissertative-argumentative type with repertoire, C3 selecting and organizing
 * arguments, C4 cohesion, C5 an intervention proposal that respects human
 * rights), each 0 to 200 in steps of 40, total 0 to 1000. An essay scores 0
 * when it flees the theme, isn't dissertative-argumentative or has up to 7
 * handwritten lines ("texto insuficiente").
 * https://download.inep.gov.br/publicacoes/institucionais/avaliacoes_e_exames_da_educacao_basica/a_redacao_no_enem_2025_cartilha_do_participante.pdf
 *
 * ENEM C5 (INEP evaluator training, Módulo 07, Competência V): the level is
 * the number of valid elements (action, agent, means or mode, effect or
 * purpose, detail) in the most complete proposal, so 5 elements are needed
 * for 200. Conditional proposals stop at 80, tangent essays at 40.
 * https://download.inep.gov.br/educacao_basica/enem/downloads/2020/Competencia_5.pdf
 *
 * AP (College Board, "Score Setting and Scoring"): free-response answers are
 * scored by AP Readers with each question's scoring guidelines, whose rows
 * award whole points for what they describe; readers score each row on its
 * own criteria. https://apcentral.collegeboard.org/courses/how-ap-develops-courses-and-exams/score-setting-and-scoring
 *
 * OAB 2nd phase (FGV answer standards, 45th exam): the brief is worth 5.00 and
 * its items are grouped as addressing and parties, facts, legal grounds,
 * requests and closing. Section weights average the civil (0.30, 0.10, 2.90,
 * 1.50, 0.20) and tax (0.40, 0.10, 3.50, 0.80, 0.20) standards.
 * https://oab.fgv.br/arq/648/131539_OAB%2045%20-%20PADR%C3%83O%20DE%20RESPOSTA%20-%20B002%20-%20DIREITO%20CIVIL%20-%20NOVO%20FORMATO.pdf
 * https://oab.fgv.br/arq/648/143315_OAB%2045%20-%20PADR%C3%83O%20DE%20RESPOSTA%20-%20B006%20-%20DIREITO%20TRIBUT%C3%81RIO%20-%20NOVO%20FORMATO.pdf
 */
const ENEM_STEP = 40;
const ENEM_CRITERION_MAX = 200;
const ENEM_TOTAL_MAX = 1000;
const ENEM_RANGE_MARGIN = 40;
const ENEM_RANGE_STEP = 20;
const OAB_STEP = 0.05;
const OAB_TOTAL_MAX = 5;
const OAB_RANGE_MARGIN = 0.5;
const CUSTOM_RANGE_SHARE = 0.1;
const HUNDREDTHS = 100;

/** C2 covers the theme and the text type, so annulled ENEM essays start there. */
const ENEM_ZERO_CRITERION_ID = "c2";

/**
 * ENEM annuls texts of up to 7 handwritten lines; a line holds about 8 to 10
 * words, so fewer than 60 typed words can't reach 8 lines. Other rubrics only
 * skip texts too short to hold any answer.
 */
const MIN_WORDS: Record<EssayRubric["kind"], number> = { ap: 20, custom: 20, enem: 60, oab: 20 };

/** AP readers award a row's points or not, so the range is a point either side. */
const AP_RANGE_MARGIN = 1;

const NO_ELEMENTS: EnemInterventionElements = {
  action: false,
  agent: false,
  detail: false,
  effect: false,
  means: false,
};

const ENEM_CRITERIA = [
  { id: "c1", name: "Formal writing" },
  { id: "c2", name: "Topic and references" },
  { id: "c3", name: "Argument" },
  { id: "c4", name: "Cohesion" },
  { id: "c5", name: "Intervention proposal" },
];

const OAB_CRITERIA = [
  { id: "addressing-and-parties", maxScore: 0.35, name: "Addressing and parties" },
  { id: "facts", maxScore: 0.1, name: "Facts" },
  { id: "legal-basis", maxScore: 3.2, name: "Legal basis" },
  { id: "requests", maxScore: 1.15, name: "Requests" },
  { id: "closing-and-form", maxScore: 0.2, name: "Closing and form" },
];

export type EssayCriterionDefinition = {
  id: string;
  name: string;
  maxScore: number;
  /** Only custom criteria carry one; official rubrics are described in the prompt. */
  description: string | null;
};

type EssayCriterionGrade = EssayGrade["criteria"][number];

type EssayCriterionOutput = EssayModelOutput["criteria"][string];

function toHundredths(value: number): number {
  return Math.round(value * HUNDREDTHS) / HUNDREDTHS;
}

function clamp({ max, value }: { max: number; value: number }): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(0, value)) : 0;
}

/**
 * Splits the custom maximum in hundredths so the criteria add up to it
 * exactly: 10 points over 3 criteria become 3.34, 3.33 and 3.33.
 */
function splitCustomMaxScore({ count, maxScore }: { count: number; maxScore: number }): number[] {
  const hundredths = Math.round(maxScore * HUNDREDTHS);
  const base = Math.floor(hundredths / count);
  const remainder = hundredths - base * count;

  return Array.from(
    { length: count },
    (_, index) => (base + (index < remainder ? 1 : 0)) / HUNDREDTHS,
  );
}

function getCustomCriteria(rubric: Extract<EssayRubric, { kind: "custom" }>) {
  if (rubric.criteria.length === 0 || rubric.maxScore <= 0) {
    throw new Error("A custom essay rubric needs at least one criterion and a positive maximum.");
  }

  const maxScores = splitCustomMaxScore({
    count: rubric.criteria.length,
    maxScore: rubric.maxScore,
  });

  return rubric.criteria.map((criterion, index) => ({
    description: criterion.description,
    id: `criterion-${index + 1}`,
    maxScore: maxScores[index] ?? 0,
    name: criterion.criterion,
  }));
}

/** AP scoring guideline rows keep their own points, in the item's order. */
function getApCriteria(rubric: Extract<EssayRubric, { kind: "ap" }>) {
  if (rubric.criteria.length === 0 || rubric.criteria.some((criterion) => criterion.points <= 0)) {
    throw new Error("An AP rubric needs at least one row, each worth at least a point.");
  }

  return rubric.criteria.map((criterion, index) => ({
    description: criterion.description,
    id: `criterion-${index + 1}`,
    maxScore: criterion.points,
    name: criterion.criterion,
  }));
}

export function getEssayCriteria(rubric: EssayRubric): EssayCriterionDefinition[] {
  if (rubric.kind === "ap") {
    return getApCriteria(rubric);
  }

  if (rubric.kind === "enem") {
    return ENEM_CRITERIA.map((criterion) => ({
      ...criterion,
      description: null,
      maxScore: ENEM_CRITERION_MAX,
    }));
  }

  if (rubric.kind === "oab") {
    return OAB_CRITERIA.map((criterion) => ({ ...criterion, description: null }));
  }

  return getCustomCriteria(rubric);
}

function getTotalMaxScore(rubric: EssayRubric): number {
  if (rubric.kind === "enem") {
    return ENEM_TOTAL_MAX;
  }

  if (rubric.kind === "ap") {
    return rubric.criteria.reduce((sum, criterion) => sum + criterion.points, 0);
  }

  return rubric.kind === "oab" ? OAB_TOTAL_MAX : rubric.maxScore;
}

function countWords(text: string): number {
  return text.split(/\s+/u).filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
}

export function isEssayTooShort({ essay, rubric }: { essay: string; rubric: EssayRubric }) {
  return countWords(essay) < MIN_WORDS[rubric.kind];
}

/** ENEM moves in steps of 40, OAB in steps of 0.05 and AP in whole points, like the official grids. */
function snapScore({
  kind,
  max,
  score,
}: {
  kind: EssayRubric["kind"];
  max: number;
  score: number;
}) {
  const clamped = clamp({ max, value: score });

  if (kind === "enem") {
    return Math.round(clamped / ENEM_STEP) * ENEM_STEP;
  }

  if (kind === "oab") {
    return toHundredths(Math.round(clamped / OAB_STEP) * OAB_STEP);
  }

  return kind === "ap" ? Math.round(clamped) : toHundredths(clamped);
}

function countElements(elements: EnemInterventionElements): number {
  return Object.values(elements).filter(Boolean).length;
}

function toOptionalText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

function toCriterionGrade({
  definition,
  essay,
  output,
  scoreCap,
  rubric,
}: {
  definition: EssayCriterionDefinition;
  essay: string;
  output: EssayCriterionOutput | undefined;
  scoreCap: number;
  rubric: EssayRubric;
}): EssayCriterionGrade {
  const score = snapScore({
    kind: rubric.kind,
    max: Math.min(definition.maxScore, scoreCap),
    score: output?.score ?? 0,
  });

  return {
    comment: output?.comment.trim() ?? "",
    example: score < definition.maxScore ? toOptionalText(output?.example) : null,
    id: definition.id,
    maxScore: definition.maxScore,
    name: definition.name,
    quote: findEssayQuote({ essay, quote: output?.quote ?? null }),
    score,
  };
}

/**
 * Competency 5 can't score above 40 per valid proposal element; annulled
 * essays score nothing anywhere.
 */
function getScoreCap({
  definition,
  elements,
  zeroReason,
}: {
  definition: EssayCriterionDefinition;
  elements: EnemInterventionElements | null;
  zeroReason: EssayGrade["zeroReason"];
}): number {
  if (zeroReason) {
    return 0;
  }

  if (elements && definition.id === "c5") {
    return ENEM_STEP * countElements(elements);
  }

  return definition.maxScore;
}

function getRange({
  rubric,
  total,
  zeroReason,
}: {
  rubric: EssayRubric;
  total: number;
  zeroReason: EssayGrade["zeroReason"];
}): EssayGrade["range"] {
  if (zeroReason) {
    return { high: 0, low: 0 };
  }

  const max = getTotalMaxScore(rubric);

  if (rubric.kind === "enem") {
    const snap = (value: number) => Math.round(value / ENEM_RANGE_STEP) * ENEM_RANGE_STEP;

    return {
      high: snap(clamp({ max, value: total + ENEM_RANGE_MARGIN })),
      low: snap(clamp({ max, value: total - ENEM_RANGE_MARGIN })),
    };
  }

  if (rubric.kind === "ap") {
    return {
      high: clamp({ max, value: total + AP_RANGE_MARGIN }),
      low: clamp({ max, value: total - AP_RANGE_MARGIN }),
    };
  }

  const margin = rubric.kind === "oab" ? OAB_RANGE_MARGIN : max * CUSTOM_RANGE_SHARE;

  return {
    high: toHundredths(clamp({ max, value: total + margin })),
    low: toHundredths(clamp({ max, value: total - margin })),
  };
}

function getGap(criterion: EssayCriterionGrade): number {
  return criterion.maxScore - criterion.score;
}

/** Ties go to the earlier criterion, so the choice is stable for the same scores. */
function getNextStep({
  criteria,
  output,
  zeroReason,
}: {
  criteria: EssayCriterionGrade[];
  output: EssayModelOutput;
  zeroReason: EssayGrade["zeroReason"];
}): EssayGrade["nextStep"] {
  const zeroCriterion = zeroReason
    ? criteria.find((criterion) => criterion.id === ENEM_ZERO_CRITERION_ID)
    : undefined;

  const weakest =
    zeroCriterion ??
    criteria.reduce((current, criterion) =>
      getGap(criterion) > getGap(current) ? criterion : current,
    );

  return { criterionId: weakest.id, text: output.criteria[weakest.id]?.nextStep.trim() ?? "" };
}

function assembleEssayGrade({
  essay,
  output,
  rubric,
  zeroReason,
}: {
  essay: string;
  output: EssayModelOutput;
  rubric: EssayRubric;
  zeroReason: EssayGrade["zeroReason"];
}): EssayGrade {
  const elements = rubric.kind === "enem" ? (output.interventionElements ?? NO_ELEMENTS) : null;

  const criteria = getEssayCriteria(rubric).map((definition) =>
    toCriterionGrade({
      definition,
      essay,
      output: output.criteria[definition.id],
      rubric,
      scoreCap: getScoreCap({ definition, elements, zeroReason }),
    }),
  );

  const total = toHundredths(criteria.reduce((sum, criterion) => sum + criterion.score, 0));

  return {
    criteria,
    enemInterventionElements: elements,
    nextStep: getNextStep({ criteria, output, zeroReason }),
    range: getRange({ rubric, total, zeroReason }),
    total: { maxScore: getTotalMaxScore(rubric), score: total },
    zeroReason,
  };
}

/** Only ENEM annuls essays for their content; other rubrics grade whatever is written. */
export function buildEssayGrade({
  essay,
  output,
  rubric,
}: {
  essay: string;
  output: EssayModelOutput;
  rubric: EssayRubric;
}): EssayGrade {
  const zeroReason = rubric.kind === "enem" ? output.zeroReason : null;
  return assembleEssayGrade({ essay, output, rubric, zeroReason });
}

export function buildTooShortEssayGrade(rubric: EssayRubric): EssayGrade {
  return assembleEssayGrade({
    essay: "",
    output: { criteria: {}, interventionElements: null, zeroReason: null },
    rubric,
    zeroReason: "tooShort",
  });
}
