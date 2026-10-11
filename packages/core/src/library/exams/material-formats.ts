import { isSameFormat } from "@zoonk/ai/tasks/v2/research/format-words";
import { type Citation, type ExamStructure } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { toStems } from "./topic-key";

type BlueprintFormat = ExamStructure["formats"][number];

/** The formats a teacher's announcement names in words; the rest need the notice's own terms. */
const NAMED_KINDS = [
  "essay",
  "multipleChoice",
  "shortAnswer",
  "trueFalse",
] as const satisfies readonly BlueprintFormat["kind"][];

type NamedKind = (typeof NAMED_KINDS)[number];

/**
 * How a sentence that announces a test's questions names each format, in the languages learners
 * write their notes in, without accents and in lowercase.
 */
const FORMAT_NAMES: Readonly<Record<NamedKind, readonly string[]>> = {
  essay: [
    "dissertativa",
    "dissertativas",
    "dissertativo",
    "discursiva",
    "discursivas",
    "discursivo",
    "redacao",
    "questao aberta",
    "questoes abertas",
    "pergunta aberta",
    "essay",
    "open-ended",
    "open question",
    "ensayo",
    "pregunta abierta",
    "pregunta de desarrollo",
    "question ouverte",
    "dissertation",
    "aufsatz",
    "erorterung",
    "offene frage",
  ],
  multipleChoice: [
    "multipla escolha",
    "multiple choice",
    "multiple-choice",
    "opcion multiple",
    "seleccion multiple",
    "choix multiple",
    "qcm",
    "mehrfachauswahl",
  ],
  shortAnswer: [
    "completar a tabela",
    "preencher a tabela",
    "complete a tabela",
    "lacunas",
    "complete the table",
    "fill in",
    "short answer",
    "completar la tabla",
    "rellenar",
    "completer le tableau",
    "texte a trous",
    "luckentext",
    "tabelle ausfullen",
  ],
  trueFalse: [
    "verdadeiro ou falso",
    "certo ou errado",
    "true or false",
    "true/false",
    "verdadero o falso",
    "vrai ou faux",
    "richtig oder falsch",
    "wahr oder falsch",
  ],
};

/** Where the clause naming a format ends: punctuation, or "and a" (or "and 2") before the next one. */
const CLAUSE_END = /[.;:!?,]|\s(?:e|and|y|et|und)\s+(?:uma?|an?|una?|une?|eine?|\d+)\s/iu;

/**
 * Words that say a sentence of the learner's notes is about the test's questions ("there will be a question
 * on…", "the test has two essays"), without accents and in lowercase: a topic that only names a
 * format ("Argumentative essay") is what the test covers, not how it asks.
 */
const ANNOUNCEMENT_WORDS = [
  "prova",
  "provas",
  "teste",
  "testes",
  "avaliacao",
  "questao",
  "questoes",
  "pergunta",
  "perguntas",
  "vai ter",
  "vai cair",
  "vao cair",
  "tera",
  "havera",
  "test",
  "tests",
  "exam",
  "exams",
  "quiz",
  "question",
  "questions",
  "will have",
  "there will be",
  "examen",
  "prueba",
  "pregunta",
  "preguntas",
  "habra",
  "epreuve",
  "controle",
  "interro",
  "interrogation",
  "prufung",
  "klausur",
  "frage",
  "fragen",
  "aufgabe",
  "aufgaben",
] as const;

/** Where a sentence of the learner's notes ends: a line break, or ".", "!" or "?" before a space. */
const SENTENCE_END = /\n+|(?<=[.!?])\s+/u;

/**
 * One code unit per code unit, without its accent and in lowercase, so positions in it are the
 * passage's own.
 */
function fold(text: string): string {
  return text
    .split("")
    .map((char) => (char.normalize("NFD")[0] ?? char).toLowerCase())
    .join("");
}

/** The words of the passage that name a format, from its name to the end of its clause. */
function describe({ passage, start }: { passage: string; start: number }): string {
  const rest = passage.slice(start);
  const end = CLAUSE_END.exec(rest)?.index ?? rest.length;
  const clause = rest.slice(0, end).trim();

  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

/** A phrase as a whole word or words: "teste" in "o teste", not in "contestes". */
function toPhrasePattern(phrase: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "u");
}

/** The first place the passage names a format of this kind, on word boundaries, or -1. */
function findName({ kind, passage }: { kind: NamedKind; passage: string }): number {
  const folded = fold(passage);

  const starts = FORMAT_NAMES[kind].flatMap((name) => {
    const at = toPhrasePattern(name).exec(folded);
    return at ? [at.index] : [];
  });

  return starts.length > 0 ? Math.min(...starts) : -1;
}

/** Whether a sentence speaks of the test's questions (`ANNOUNCEMENT_WORDS`). */
function speaksOfTest(sentence: string): boolean {
  const folded = fold(sentence);
  return ANNOUNCEMENT_WORDS.some((word) => toPhrasePattern(word).test(folded));
}

/** Whether a sentence names a format a teacher's announcement names in words. */
function namesFormat(sentence: string): boolean {
  return NAMED_KINDS.some((kind) => findName({ kind, passage: sentence }) >= 0);
}

/**
 * The sentences of the learner's documents that announce the test's questions and name a format
 * ("The teacher said: there will be a question to fill in the organelles table and an essay on
 * osmosis!"), each quoted from its document as it's written.
 */
function listAnnouncements(documents: readonly ExtractionDocument[]): Citation[] {
  return documents.flatMap(({ sourceId, text }) =>
    (text ?? "")
      .split(SENTENCE_END)
      .map((sentence) => sentence.trim())
      .filter((sentence) => speaksOfTest(sentence) && namesFormat(sentence))
      .map((passage) => ({ passage, sourceId })),
  );
}

/**
 * Whether a format already asks what a passage names: one of its kind quoting this passage, or one
 * asking the same thing from another quote of the announcement (or read as "other").
 */
function isKnown({
  format,
  known,
}: {
  format: BlueprintFormat;
  known: readonly BlueprintFormat[];
}): boolean {
  return known.some(
    (other) =>
      (other.kind === format.kind && other.citation.passage === format.citation.passage) ||
      isSameFormat(other, format),
  );
}

/** The formats a passage names, in the order it names them, described in its own words. */
function findPassageFormats(citation: Citation): BlueprintFormat[] {
  return NAMED_KINDS.map((kind) => ({ kind, start: findName({ kind, passage: citation.passage }) }))
    .filter((entry) => entry.start >= 0)
    .toSorted((first, second) => first.start - second.start)
    .map(({ kind, start }) => ({
      citation,
      description: describe({ passage: citation.passage, start }),
      kind,
      options: null,
    }));
}

/**
 * Every format the learner's own material announces that no read format has: the announcement
 * often names two in one sentence ("there will be a question to fill in the organelles table and
 * an essay on osmosis!"), and a reading may keep only one, or none when its check drops
 * them. Code reads them from the passages the reading quoted and from every sentence of the
 * documents that announces the test's questions, each described in the passage's own words from
 * where it's named, so the formats a teacher announced never depend on a model finding them. Only
 * for the learner's own material: a notice's passage naming a subject ("Official Writing") isn't
 * an essay.
 */
export function findNamedFormats({
  documents,
  formats,
}: {
  documents: readonly ExtractionDocument[];
  formats: readonly BlueprintFormat[];
}): BlueprintFormat[] {
  const citations = [...formats.map((format) => format.citation), ...listAnnouncements(documents)];

  const passages = [...new Map(citations.map((citation) => [citation.passage, citation])).values()];

  const named = passages.flatMap((citation) => findPassageFormats(citation));

  // A format the reading has, or one an earlier passage named (one sentence quoted twice), stays once.
  return named.filter(
    (format, index) => !isKnown({ format, known: [...formats, ...named.slice(0, index)] }),
  );
}

/** Words that join what a question is about to how it asks ("about", "with"). */
const LINKING_WORDS = ["sobre", "acerca", "about", "entre", "para", "with", "uber", "avec"];

/**
 * How a question is asked, as stems: the format names and the words that announce a test ("table"
 * in "fill in the table", "question", "test"), which say nothing of the topic it's about.
 */
const ASKING_STEMS = new Set(
  [...Object.values(FORMAT_NAMES).flat(), ...ANNOUNCEMENT_WORDS, ...LINKING_WORDS].flatMap(
    (phrase) => toStems(phrase),
  ),
);

/**
 * The stems of what an announced question is about, without how it asks: "Essay on
 * osmosis" is about "osmosis", "Fill in the organelles table" about "organelles".
 */
export function toAnnouncedStems(description: string): string[] {
  return toStems(description).filter((stem) => !ASKING_STEMS.has(stem));
}

/** The stems that name a format alone ("fill in", "table", "essay"), not a test's. */
const FORMAT_STEMS = new Set(
  Object.values(FORMAT_NAMES)
    .flat()
    .flatMap((name) => toStems(name))
    .filter(
      (stem) =>
        ![...ANNOUNCEMENT_WORDS, ...LINKING_WORDS].some((word) => toStems(word).includes(stem)),
    ),
);

/**
 * How an announced question asks, as the stems of the format names it uses: "Fill-in-the-table
 * question" asks by "fill in" and "table", whatever it's about. Empty when it names no format.
 */
export function toFormatStems(description: string): string[] {
  return toStems(description).filter((stem) => FORMAT_STEMS.has(stem));
}

/**
 * What a class test's formats announce, as the reading describes each and in the words of the
 * passage it quotes, from where that passage names the format: a reading that keeps only the
 * format ("Fill-in-the-table question.") still says what the teacher said it asks about
 * ("Fill in the organelles table").
 */
export function listAnnouncedQuestions(formats: readonly BlueprintFormat[]): string[] {
  return [
    ...new Set(
      formats.flatMap((format) => [
        format.description,
        ...findPassageFormats(format.citation)
          .filter((named) => named.kind === format.kind)
          .map((named) => named.description),
      ]),
    ),
  ];
}
