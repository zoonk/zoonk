import answers from "./asap-answers.json";
import ellipse from "./ellipse-answers.json";
import { type Grading, type WritingCase, basis } from "./shared";

const ELLIPSE =
  "https://github.com/scrosseye/ELLIPSE-Corpus/blob/710963bbf1acf23a28e40643d9f937d06f047dd4/ELL_Rubrics.docx";

const ASAP =
  "https://github.com/scrosseye/ASAP_2.0/blob/060ab225ca0984c0bf43ff222bf6bb2bc6195b6f/asap_scoring_rubric.docx";

function scale(id: string, text: string, descriptions: readonly string[], sourceId: string) {
  const citation = { passage: text, sourceId };

  return {
    awards: descriptions.map((description, index) => ({
      citation,
      points: index + 1,
      text: description,
    })),
    citation,
    id,
    points: descriptions.length,
    text,
  };
}

const ELLIPSE_SCALES = [
  [
    "cohesion",
    "Organization and links between ideas",
    [
      "Unclear order and absent or unsuccessful links between ideas.",
      "Partly developed order, with basic links used inaccurately or repetitively.",
      "Generally organized, but links are narrow in range, repetitive, mechanical, or faulty.",
      "Generally controlled organization with a range of appropriate references and transitions.",
      "Consistently controlled organization with varied, effective connections across sentences and paragraphs.",
    ],
  ],
  [
    "syntax",
    "Sentence structure",
    [
      "Persistent basic errors in structure and word order make sentences confusing.",
      "Some variety, with many structural problems.",
      "Uses simple, compound and complex sentences with a limited range and noticeable errors.",
      "Uses varied sentence structures appropriately with occasional errors.",
      "Uses a wide range of structures flexibly with only rare, minor slips.",
    ],
  ],
  [
    "vocabulary",
    "Word choice and range",
    [
      "Very limited selection, often inappropriate, with little control of forms.",
      "Narrow range and errors in selection or form that may distort meaning.",
      "Enough for the topic, with limited precision and some inaccurate attempts at less familiar words.",
      "Enough range for precision and flexibility, including appropriate topic vocabulary and less common words.",
      "Wide, flexible and precise range, including skillful topic vocabulary and only negligible slips.",
    ],
  ],
  [
    "phraseology",
    "Phrases and multiword patterns",
    [
      "Mostly memorized strings or simple patterns, often repeated or misused.",
      "Limited phrases convey basic meaning, with frequent repetition or misuse.",
      "Uses idioms or other multiword patterns with limited variety and noticeable repetition or misuse.",
      "Uses a variety of phrases appropriately with occasional inaccuracies.",
      "Uses varied idioms and other word combinations flexibly and precisely, with rare negligible slips.",
    ],
  ],
  [
    "grammar",
    "Grammar and usage",
    [
      "Errors in grammar and usage throughout.",
      "Frequent errors in grammar and usage.",
      "Some errors in grammar and usage.",
      "Few errors in grammar and usage.",
      "Strong command of grammar and usage, with virtually no errors.",
    ],
  ],
  [
    "conventions",
    "Spelling, capitalization and punctuation",
    [
      "Uses written conventions minimally.",
      "Frequent, distracting errors in spelling, capitals or punctuation.",
      "Developing control, with some distracting errors.",
      "Generally consistent control with few, unobtrusive errors.",
      "Consistent control with negligible errors, if any.",
    ],
  ],
] as const;

const ASAP_SCALE = scale(
  "quality",
  "Overall quality of the source-based argument",
  [
    "No viable position or evidence, severely disorganized, or serious language errors throughout.",
    "Vague or limited position and weak evidence, serious organizational or language problems.",
    "Developing position and reasoning, with uneven use of evidence or clear gaps in organization or language.",
    "Competent position and reasoning supported by adequate source evidence and generally organized prose.",
    "Effective position and strong reasoning, appropriate source evidence, coherent structure and generally fluent language.",
    "Insightful position and reasoning, persuasive source evidence, clear progression, precise and varied language with few errors.",
  ],
  ASAP,
);

function markedCase({
  context,
  criteria,
  id,
  question,
  score,
  source,
  text,
}: {
  context: string | null;
  criteria: Grading["criteria"];
  id: string;
  question: string;
  score: number;
  source: string;
  text: string;
}): WritingCase {
  const [first] = criteria;

  if (!first) {
    throw new Error("A writing scale needs a criterion.");
  }

  return {
    expected: { earned: [], feedbackLanguage: "en", officialTotal: score, zero: false },
    id: `${source}-${id}-en`,
    language: "en",
    userInput: {
      basis: basis({
        aspects: [],
        criteria: criteria.map(({ id: criterionId, points, text: name }) => ({
          id: criterionId,
          name,
          points,
        })),
        grading: {
          combination: {
            citation: first.citation,
            method: "mean",
            step: null,
            text: "Average the criterion marks equally.",
          },
          criteria,
          language: null,
          rounding: null,
          zeroing: [],
        },
        lines: null,
        taskKey: source,
        title: source,
        total: criteria[0]?.points ?? null,
      }),
      context,
      keyPoints: [],
      language: "en",
      numeric: true,
      question,
      text,
    },
  };
}

const ellipseCriteria = ELLIPSE_SCALES.map(([id, name, bars]) => scale(id, name, bars, ELLIPSE));

export const ELLIPSE_CASES = ellipse.map(({ id, prompt, scores, text }) =>
  markedCase({
    context: null,
    criteria: ellipseCriteria,
    id,
    question: `Write an essay in English on this topic: ${prompt}.`,
    score: scores.reduce((sum, value) => sum + value, 0) / scores.length,
    source: "ellipse",
    text,
  }),
);

export function asapCases(articleTexts?: Readonly<Record<string, string>>): WritingCase[] {
  return answers.answers.map(({ id, prompt, score, text }) => {
    const source = answers.sources[prompt as keyof typeof answers.sources];

    return markedCase({
      context: articleTexts?.[source.file] ?? null,
      criteria: [ASAP_SCALE],
      id,
      question: source.question,
      score,
      source: "asap-2",
      text,
    });
  });
}
