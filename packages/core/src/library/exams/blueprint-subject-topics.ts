import { type BlueprintExtraction } from "@zoonk/ai/tasks/v2/research/extract-exam-blueprint";
import { type ExamStructure } from "./blueprint-contract";
import { findStatedTopics } from "./blueprint-facts";
import { type ExtractionDocument } from "./blueprint-passages";
import { type TopicGroup, groupTopicsByHeading } from "./topic-groups";

type ExtractionSubject = BlueprintExtraction["subjects"][number];

const ITEM_NUMBER = /^\d+(?:\.\d+)*[.)]?\s+/u;

function toTopic(topic: string): string {
  return topic.trim().replace(/[.;,:]+$/u, "");
}

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

function toMatrix({
  documents,
  subject,
}: {
  documents: ExtractionDocument[];
  subject: ExtractionSubject;
}): { matrix?: string[] } {
  const matrix = subject.matrix ?? [];
  const stated = findStatedTopics({ documents, subject: { ...subject, topics: matrix } });
  return stated.length > 0 ? { matrix: [...new Set(stated.map((line) => toTopic(line)))] } : {};
}

function toTopicGroups({
  documents,
  stated,
  subject,
}: {
  documents: ExtractionDocument[];
  stated: ReadonlySet<string>;
  subject: ExtractionSubject;
}): { topicGroups?: TopicGroup[] } {
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
