import {
  type BlueprintContent,
  type ExamStructure,
  type TopicFrequency,
} from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { findNamedFormats } from "./material-formats";
import { toStems, toTopicKey } from "./topic-key";

/** A heading's number or bullet: "1)", "2.", "3.1", "b)", "IV -", "•". */
const NUMBERING = /^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Za-z][.)]|[IVXL]{1,4}\s*[.)–-]|[-–•*·])\s+/u;

/** A remark after the topic's words: "(CAI MUITO!!)", "- IMPORTANTE", or a run of "!". */
const TRAILING_REMARK = /\s*(?:\((?<aside>[^()]*)\)|\s[-–]\s+(?<dash>.+)|(?<bang>!+))\s*$/u;

/** No small letters: a remark in capitals stresses ("IMPORTANTE"), unless it's an acronym. */
const IN_CAPITALS = /^[^\p{Ll}]*$/u;

/** An acronym in parentheses names the topic ("(DNA)", "(RE)"): a short word in capitals. */
const MIN_SHOUTED_LETTERS = 6;

type MaterialTopic = { emphasis: string | null; name: string };

/** A remark that stresses the topic (in capitals or with "!") rather than saying what it holds. */
function isEmphasis(remark: string): boolean {
  const letters = remark.replaceAll(/[^\p{L}]/gu, "").length;
  const isPhrase = /\s/u.test(remark) || letters >= MIN_SHOUTED_LETTERS;

  return remark.includes("!") || (letters > 0 && IN_CAPITALS.test(remark) && isPhrase);
}

/**
 * A heading of the learner's own material as a topic: its words without the numbering, and the
 * learner's own remark that it matters ("CAI MUITO!!") taken out of its name as emphasis. A remark
 * that says what the topic holds ("(mitocôndria e cloroplasto)") stays in it.
 */
function cleanMaterialTopic(heading: string): MaterialTopic {
  const words = heading.replace(NUMBERING, "").trim();
  const remark = TRAILING_REMARK.exec(words);
  const parts = remark?.groups;
  const stress = (parts?.aside ?? parts?.dash ?? parts?.bang ?? "").trim();
  const stressed = remark !== null && isEmphasis(stress);
  const name = (stressed ? words.slice(0, remark.index) : words).trim();

  return name.length > 0
    ? { emphasis: stressed ? stress : null, name }
    : { emphasis: null, name: heading.trim() };
}

/** The document a heading is written in, as the citation of the learner's emphasis on it. */
function findSourceId({
  documents,
  fallback,
  heading,
}: {
  documents: readonly ExtractionDocument[];
  fallback: string;
  heading: string;
}): string {
  return documents.find((document) => document.text?.includes(heading))?.sourceId ?? fallback;
}

/** What the learner's material stresses, as frequency: their "CAI MUITO!!" comes up a lot. */
function toEmphasisFrequency({
  content,
  documents,
}: {
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
}): TopicFrequency {
  return content.structure.subjects.flatMap((subject) =>
    subject.topics.flatMap((heading) => {
      const { emphasis, name } = cleanMaterialTopic(heading);

      if (!emphasis) {
        return [];
      }

      const sourceId = findSourceId({ documents, fallback: subject.citation.sourceId, heading });

      return [
        {
          appearances: null,
          basis: emphasis,
          citation: { passage: heading, sourceId },
          level: "high" as const,
          subject: subject.name,
          topic: name,
        },
      ];
    }),
  );
}

const toName = (topic: string) => cleanMaterialTopic(topic).name;

type BlueprintFormat = ExamStructure["formats"][number];

/** A heading's part of the material: the heading and what's under it, up to the next heading. */
type Section = { heading: string; stems: Set<string> };

/**
 * Each heading's part of the learner's documents, without the sentences that announce the test's
 * formats: the announcement sits under the last heading, but it's about every topic it names.
 */
function listSections({
  announcements,
  documents,
  headings,
}: {
  announcements: readonly string[];
  documents: readonly ExtractionDocument[];
  headings: readonly string[];
}): Section[] {
  return documents.flatMap(({ text }) => {
    if (!text) {
      return [];
    }

    const found = headings
      .map((heading) => ({ heading, start: text.indexOf(heading) }))
      .filter((entry) => entry.start >= 0)
      .toSorted((a, b) => a.start - b.start);

    return found.map((entry, index) => {
      const part = text.slice(entry.start, found[index + 1]?.start ?? text.length);
      const said = announcements.reduce((rest, passage) => rest.replaceAll(passage, " "), part);

      return { heading: entry.heading, stems: new Set(toStems(said)) };
    });
  });
}

/**
 * The headings an announced format asks about ("uma dissertativa sobre osmose"): the ones whose
 * name it says ("a tabela das organelas"), else the one heading whose part of the material holds
 * a word of it that no other part does (osmosis is under "Membrana plasmática"). None when its
 * words point at several topics or at none.
 */
function findAnnouncedHeadings({
  format,
  headings,
  sections,
}: {
  format: BlueprintFormat;
  headings: readonly string[];
  sections: readonly Section[];
}): string[] {
  const said = toStems(format.description);

  const named = headings.filter((heading) => {
    const stems = toStems(toName(heading));
    return stems.length > 0 && stems.every((stem) => said.includes(stem));
  });

  if (named.length > 0) {
    return named;
  }

  const pointed = new Set(
    said.flatMap((stem) => {
      const holding = new Set(
        sections.filter((section) => section.stems.has(stem)).map((section) => section.heading),
      );

      return holding.size === 1 ? [...holding] : [];
    }),
  );

  return pointed.size === 1 ? [...pointed] : [];
}

/**
 * What the test announces, as frequency: a topic the teacher said a question is about ("vai ter
 * uma dissertativa sobre osmose") comes up on the test, so it counts as coming up a lot, cited to
 * the announcement.
 */
function toAnnouncedFrequency({
  content,
  documents,
  formats,
}: {
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
  formats: readonly BlueprintFormat[];
}): TopicFrequency {
  const announcements = [...new Set(formats.map((format) => format.citation.passage))];

  return content.structure.subjects.flatMap((subject) => {
    const sections = listSections({ announcements, documents, headings: subject.topics });

    return formats.flatMap((format) =>
      findAnnouncedHeadings({ format, headings: subject.topics, sections }).map((heading) => ({
        appearances: null,
        basis: format.description,
        citation: format.citation,
        level: "high" as const,
        subject: subject.name,
        topic: toName(heading),
      })),
    );
  });
}

const toFrequencyKey = (entry: Pick<TopicFrequency[number], "subject" | "topic">) =>
  `${entry.subject}\n${toTopicKey(entry.topic)}`;

/**
 * A blueprint read from the learner's own material (class notes, slides) as the plan and its
 * pages show it: each topic in the material's words without its numbering or the learner's
 * remarks; the topics they stressed ("4) Organelas (CAI MUITO!!)") and the ones the test announces
 * a question about ("uma dissertativa sobre osmose") marked as coming up a lot, which gives them
 * more of the time and keeps them in a plan short on time, unless the reading already said how
 * often they come up; and every question format the material announces, so its practice rehearses
 * all of them.
 */
export function toMaterialContent({
  content,
  documents,
}: {
  content: BlueprintContent;
  documents: readonly ExtractionDocument[];
}): BlueprintContent {
  const read = content.topicFrequency.map((entry) => ({ ...entry, topic: toName(entry.topic) }));
  const formats = [
    ...content.structure.formats,
    ...findNamedFormats({ documents, formats: content.structure.formats }),
  ];

  const marked = [
    ...read,
    ...toEmphasisFrequency({ content, documents }),
    ...toAnnouncedFrequency({ content, documents, formats }),
  ];

  // Each topic once: what the reading said first, then the learner's own stress, then the test's.
  const frequency = marked.filter(
    (entry, index) =>
      marked.findIndex((other) => toFrequencyKey(other) === toFrequencyKey(entry)) === index,
  );

  return {
    ...content,
    structure: {
      ...content.structure,
      formats,
      subjects: content.structure.subjects.map((subject) => ({
        ...subject,
        topicGroups: subject.topicGroups?.map((group) => ({
          ...group,
          topics: [...new Set(group.topics.map((topic) => toName(topic)))],
        })),
        topics: [...new Set(subject.topics.map((topic) => toName(topic)))],
      })),
    },
    topicFrequency: frequency,
  };
}
