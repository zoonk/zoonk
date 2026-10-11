import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type ExamStructure } from "./blueprint-contract";
import { findStatedTopics } from "./blueprint-facts";
import { type ExtractionDocument } from "./blueprint-passages";
import { type TopicGroup, groupTopicsByHeading } from "./topic-groups";

type ExtractionSubject = BlueprintExtraction["subjects"][number];

/** An item's number ahead of its words, such as "1. " or "4.1 ". */
const ITEM_NUMBER = /^\d+(?:\.\d+)*[.)]?\s+/u;

/** A topic as a syllabus line reads: its words, without the period that ends the item. */
function toTopic(topic: string): string {
  return topic.trim().replace(/[.;,:]+$/u, "");
}

/**
 * The subject with its topics as its documents write them: a reading numbers a list the syllabus
 * doesn't ("1. Crase" for "Crase"), and a topic the documents don't state word for word is dropped,
 * so a number the documents don't have is taken off. An item the syllabus numbers keeps it.
 */
function withoutAddedNumbers({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: ExtractionSubject;
}): ExtractionSubject {
  const stated = new Set(findStatedTopics({ documents, subject }));

  const topics = subject.topics.map((topic) =>
    stated.has(topic) ? topic : topic.trim().replace(ITEM_NUMBER, ""),
  );

  return { ...subject, topics };
}

/**
 * A skills matrix's statements the subject's documents state word for word, when its topics are
 * the matrix's contents; nothing otherwise, so other syllabi keep their shape.
 */
function toMatrix({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: ExtractionSubject;
}): { matrix?: string[] } {
  // Readings recorded before the matrix was asked for have none.
  const matrix = subject.matrix ?? [];
  const stated = findStatedTopics({ documents, subject: { ...subject, topics: matrix } });
  return stated.length > 0 ? { matrix: [...new Set(stated.map((line) => toTopic(line)))] } : {};
}

/**
 * The subject's topics under the syllabus's own headings (ENEM's physics, chemistry and biology),
 * for headings its documents state; nothing for a syllabus without them, so others keep their
 * shape.
 */
function toTopicGroups({
  documents,
  stated,
  subject,
}: {
  documents: ExtractionDocument[];
  /** The subject's topics its documents state (see `findStatedTopics`). */
  stated: ReadonlySet<string>;
  subject: ExtractionSubject;
}): { topicGroups?: TopicGroup[] } {
  // Readings recorded before headings were asked for have none.
  const headings = subject.topicHeadings ?? [];

  const named = new Set(
    findStatedTopics({
      documents,
      subject: { ...subject, topics: headings.map((heading) => heading.name) },
    }),
  );

  const groups = groupTopicsByHeading({
    headings: headings
      .filter((heading) => named.has(heading.name))
      .map((heading) => ({ ...heading, firstTopic: toTopic(heading.firstTopic) })),
    topics: subject.topics.map((topic) => ({ kept: stated.has(topic), text: toTopic(topic) })),
  });

  return groups.length > 0 ? { topicGroups: groups } : {};
}

/**
 * A subject's syllabus as the blueprint stores it: the topics its documents state word for word,
 * and the matrix and headings over them when the syllabus has them.
 */
export function toSubjectTopics({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: ExtractionSubject;
}): Pick<ExamStructure["subjects"][number], "matrix" | "topicGroups" | "topics"> {
  const read = withoutAddedNumbers({ documents, subject });
  const stated = findStatedTopics({ documents, subject: read });

  return {
    topics: [...new Set(stated.map((topic) => toTopic(topic)))],
    ...toMatrix({ documents, subject: read }),
    ...toTopicGroups({ documents, stated: new Set(stated), subject: read }),
  };
}
