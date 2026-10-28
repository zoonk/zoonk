import { isSameFormat } from "@zoonk/ai/tasks/v2/research/format-words";
import { type Citation, type ExamStructure } from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { toStems } from "./topic-key";

type BlueprintFormat = ExamStructure["formats"][number];

const NAMED_KINDS = [
  "essay",
  "multipleChoice",
  "shortAnswer",
  "trueFalse",
] as const satisfies readonly BlueprintFormat["kind"][];

type NamedKind = (typeof NAMED_KINDS)[number];

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

const CLAUSE_END = /[.;:!?,]|\s(?:e|and|y|et|und)\s+(?:uma?|an?|una?|une?|eine?|\d+)\s/iu;

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

const SENTENCE_END = /\n+|(?<=[.!?])\s+/u;

function fold(text: string): string {
  return text
    .split("")
    .map((char) => (char.normalize("NFD")[0] ?? char).toLowerCase())
    .join("");
}

function describe({ passage, start }: { passage: string; start: number }): string {
  const rest = passage.slice(start);
  const end = CLAUSE_END.exec(rest)?.index ?? rest.length;
  const clause = rest.slice(0, end).trim();

  return clause.charAt(0).toUpperCase() + clause.slice(1);
}

function toPhrasePattern(phrase: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${phrase}(?![\\p{L}\\p{N}])`, "u");
}

function findName({ kind, passage }: { kind: NamedKind; passage: string }): number {
  const folded = fold(passage);

  const starts = FORMAT_NAMES[kind].flatMap((name) => {
    const at = toPhrasePattern(name).exec(folded);
    return at ? [at.index] : [];
  });

  return starts.length > 0 ? Math.min(...starts) : -1;
}

function speaksOfTest(sentence: string): boolean {
  const folded = fold(sentence);
  return ANNOUNCEMENT_WORDS.some((word) => toPhrasePattern(word).test(folded));
}

function namesFormat(sentence: string): boolean {
  return NAMED_KINDS.some((kind) => findName({ kind, passage: sentence }) >= 0);
}

function listAnnouncements(documents: readonly ExtractionDocument[]): Citation[] {
  return documents.flatMap(({ sourceId, text }) =>
    (text ?? "")
      .split(SENTENCE_END)
      .map((sentence) => sentence.trim())
      .filter((sentence) => speaksOfTest(sentence) && namesFormat(sentence))
      .map((passage) => ({ passage, sourceId })),
  );
}

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

  return named.filter(
    (format, index) => !isKnown({ format, known: [...formats, ...named.slice(0, index)] }),
  );
}

const LINKING_WORDS = ["sobre", "acerca", "about", "entre", "para", "with", "uber", "avec"];

const ASKING_STEMS = new Set(
  [...Object.values(FORMAT_NAMES).flat(), ...ANNOUNCEMENT_WORDS, ...LINKING_WORDS].flatMap(
    (phrase) => toStems(phrase),
  ),
);

export function toAnnouncedStems(description: string): string[] {
  return toStems(description).filter((stem) => !ASKING_STEMS.has(stem));
}

const FORMAT_STEMS = new Set(
  Object.values(FORMAT_NAMES)
    .flat()
    .flatMap((name) => toStems(name))
    .filter(
      (stem) =>
        ![...ANNOUNCEMENT_WORDS, ...LINKING_WORDS].some((word) => toStems(word).includes(stem)),
    ),
);

export function toFormatStems(description: string): string[] {
  return toStems(description).filter((stem) => FORMAT_STEMS.has(stem));
}

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
