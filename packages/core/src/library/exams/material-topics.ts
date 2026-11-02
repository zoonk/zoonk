import {
  type BlueprintContent,
  type ExamStructure,
  type TopicFrequency,
} from "./blueprint-contract";
import { type ExtractionDocument } from "./blueprint-passages";
import { findNamedFormats } from "./material-formats";
import { toStems, toTopicKey } from "./topic-key";

const NUMBERING = /^\s*(?:\d+(?:\.\d+)*[.)]?|[A-Za-z][.)]|[IVXL]{1,4}\s*[.)–-]|[-–•*·])\s+/u;

const TRAILING_REMARK = /\s*(?:\((?<aside>[^()]*)\)|\s[-–]\s+(?<dash>.+)|(?<bang>!+))\s*$/u;

const IN_CAPITALS = /^[^\p{Ll}]*$/u;

const MIN_SHOUTED_LETTERS = 6;

type MaterialTopic = { emphasis: string | null; name: string };

function isEmphasis(remark: string): boolean {
  const letters = remark.replaceAll(/[^\p{L}]/gu, "").length;
  const isPhrase = /\s/u.test(remark) || letters >= MIN_SHOUTED_LETTERS;

  return remark.includes("!") || (letters > 0 && IN_CAPITALS.test(remark) && isPhrase);
}

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

type Section = { heading: string; stems: Set<string> };

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
