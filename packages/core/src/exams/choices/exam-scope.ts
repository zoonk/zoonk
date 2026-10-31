import { isSameNameWord, toNameWords } from "@zoonk/utils/name-words";
import { normalizeString } from "@zoonk/utils/string";
import { type ExamStructure } from "../../library/exams/blueprint-contract";
import { getSubjectQuestions } from "../../library/exams/subject-questions";
import { findSubjectSections } from "../mocks/exam-parts";
import { listCountedSubjects } from "./choice-groups";

type Subject = ExamStructure["subjects"][number];
type Mock = NonNullable<ExamStructure["mock"]>;
type Section = Mock["sections"][number];

const NUMERAL = /^(?:[ivxlc]+|\d+)$/u;

const SCRIPTS = [
  /\p{Script=Latin}/u,
  /\p{Script=Han}/u,
  /\p{Script=Hiragana}/u,
  /\p{Script=Katakana}/u,
  /\p{Script=Hangul}/u,
  /\p{N}/u,
];

/** NFKC so a learner's 数学I and a notice's 数学Ⅰ are the same name. */
function toKey(name: string): string {
  return normalizeString(name.normalize("NFKC"));
}

function toNames(subject: Subject): string[] {
  return [subject.name, subject.shortName ?? ""].map((name) => toKey(name)).filter(Boolean);
}

function isSameScript(first: string, second: string): boolean {
  return SCRIPTS.some((script) => script.test(first) && script.test(second));
}

/**
 * Names written without spaces (数学Ⅰ，数学A) can only start with the learner's word, ending where
 * the script changes: 数学 starts 数学Ⅰ but 数学I doesn't start 数学Ⅱ, and 国語 inside 外国語 is
 * another subject.
 */
function startsName({ name, said }: { name: string; said: string }): boolean {
  const next = name.slice(said.length, said.length + 1);
  const last = said.slice(-1);
  return name.startsWith(said) && !(next && last && isSameScript(last, next));
}

/** "math" starts "mathematics", but a numbered subject (数学II) never starts another (数学III). */
function isSameWord({ said, word }: { said: string; word: string }): boolean {
  const [short, long] = said.length <= word.length ? [said, word] : [word, said];
  return isSameNameWord(said, word) && !NUMERAL.test(long.slice(short.length));
}

function namesWords({ name, said }: { name: string; said: string }): boolean {
  const words = toNameWords(name);
  const saidWords = toNameWords(said);

  return (
    saidWords.length > 0 &&
    saidWords.every((part) => words.some((word) => isSameWord({ said: part, word })))
  );
}

function namesPartly({ said, subject }: { said: string; subject: Subject }): boolean {
  return toNames(subject).some((name) => startsName({ name, said }) || namesWords({ name, said }));
}

function namesExactly({ said, subject }: { said: string; subject: Subject }): boolean {
  const groups = [subject.group, subject.choiceGroup].flatMap((name) =>
    name ? [toKey(name)] : [],
  );

  return [...toNames(subject), ...groups].includes(said);
}

function findNamedSubjects({
  said,
  subjects,
}: {
  said: string;
  subjects: readonly Subject[];
}): Subject[] {
  const exact = subjects.filter((subject) => namesExactly({ said, subject }));
  return exact.length > 0 ? exact : subjects.filter((subject) => namesPartly({ said, subject }));
}

function addParts({ named, subjects }: { named: Set<string>; subjects: readonly Subject[] }) {
  return new Set([
    ...named,
    ...subjects.flatMap((subject) =>
      subject.partOf && named.has(subject.partOf) ? [subject.name] : [],
    ),
  ]);
}

function sumStated(values: readonly (number | null)[]): number | null {
  return values.every((value) => value !== null)
    ? values.reduce<number>((total, value) => total + (value ?? 0), 0)
    : null;
}

function countQuestions({
  structure,
  subjects,
}: {
  structure: ExamStructure;
  subjects: readonly Subject[];
}): number | null {
  return sumStated(
    listCountedSubjects({ choiceGroups: structure.choiceGroups, subjects }).map((subject) =>
      getSubjectQuestions({ structure, subject }),
    ),
  );
}

/** The kept subjects' questions out of all the asked ones'; all of it when either is unstated. */
function getKeptShare({
  asked,
  kept,
  structure,
}: {
  asked: readonly Subject[];
  kept: ReadonlySet<string>;
  structure: ExamStructure;
}): number {
  const ours = asked.filter((subject) => kept.has(subject.name));
  const own = countQuestions({ structure, subjects: ours });
  const total = countQuestions({ structure, subjects: asked });

  return total && own !== null ? Math.min(1, own / total) : 1;
}

function scaleBy(value: number | null, share: number): number | null {
  return value === null ? null : Math.max(1, Math.round(value * share));
}

/**
 * The sections that ask a kept subject, a shared one cut to the kept subjects' share of its
 * questions and time; null when no section is found to ask one.
 */
function scopeSections({
  kept,
  structure,
}: {
  kept: ReadonlySet<string>;
  structure: ExamStructure;
}): Section[] | null {
  const sections = structure.mock?.sections ?? [];
  const names = sections.map((section) => section.name);
  const asking = (subject: Subject) => findSubjectSections({ sections: names, structure, subject });

  if (!structure.subjects.some((subject) => kept.has(subject.name) && asking(subject).length > 0)) {
    return null;
  }

  return sections.flatMap((section) => {
    const asked = structure.subjects.filter((subject) => asking(subject).includes(section.name));

    const share = asked.some((subject) => kept.has(subject.name))
      ? getKeptShare({ asked, kept, structure })
      : 0;

    if (share === 0) {
      return [];
    }

    return share === 1
      ? [section]
      : [
          {
            ...section,
            minutes: scaleBy(section.minutes, share),
            questions: scaleBy(section.questions, share),
          },
        ];
  });
}

/**
 * Part of an exam has no share of the exam's points to score on, so its mock counts right answers.
 * Sections no subject is found in stay whole; without sections, the exam's size is cut to its
 * subjects' share.
 */
function scopeMock({
  kept,
  structure,
}: {
  kept: ReadonlySet<string>;
  structure: ExamStructure;
}): ExamStructure["mock"] {
  const { mock } = structure;

  if (!mock) {
    return mock;
  }

  const { finalShares: _shares, marking: _marking, parts: _parts, ...rest } = mock.scoring;
  const scoring = { ...rest, totalMinimum: null };
  const sections = scopeSections({ kept, structure });

  if (!sections && mock.sections.length > 0) {
    return { ...mock, scoring };
  }

  if (!sections) {
    const share = getKeptShare({ asked: structure.subjects, kept, structure });

    return {
      ...mock,
      scoring,
      timeLimitMinutes: scaleBy(mock.timeLimitMinutes, share),
      totalQuestions: scaleBy(mock.totalQuestions, share),
    };
  }

  return {
    ...mock,
    scoring,
    sections,
    timeLimitMinutes: sumStated(sections.map((section) => section.minutes)),
    totalQuestions: sumStated(sections.map((section) => section.questions)),
  };
}

/**
 * The exam as far as the learner prepares it: the subjects their words name, with the parts
 * counted inside them, and the mock as far as it asks those. The whole exam when they named none,
 * or none of their words names a subject of it.
 */
export function scopeExamStructure({
  examSubjects,
  structure,
}: {
  examSubjects: readonly string[];
  structure: ExamStructure;
}): ExamStructure {
  const named = new Set(
    examSubjects.flatMap((said) =>
      findNamedSubjects({ said: toKey(said), subjects: structure.subjects }).map(
        (subject) => subject.name,
      ),
    ),
  );

  if (named.size === 0) {
    return structure;
  }

  const kept = addParts({ named, subjects: structure.subjects });

  return {
    ...structure,
    mock: scopeMock({ kept, structure }),
    subjects: structure.subjects.filter((subject) => kept.has(subject.name)),
  };
}
