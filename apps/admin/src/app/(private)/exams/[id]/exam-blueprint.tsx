import { AdminJson } from "@/components/admin-json";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { type AdminTableColumn, AdminTableColumns } from "@/components/admin-table-columns";
import { AdminTableRow } from "@/components/admin-table-row";
import { BarList } from "@/components/bar-list";
import { type AdminExam } from "@/data/exams/get-exam";
import { formatCount } from "@/lib/format";
import {
  type ExamStructure,
  type TopicFrequency,
  examStructureSchema,
  topicFrequencySchema,
} from "@zoonk/core/library/exams/blueprint-contract";
import { type TopicFrequencyLevel } from "@zoonk/core/library/exams/blueprint-past-contract";
import { TableCell } from "@zoonk/ui/components/table";

const SECTION_COLUMNS: AdminTableColumn[] = [
  { label: "Day", size: "narrow" },
  { fill: true, label: "Part" },
  { align: "right", label: "Questions" },
  { align: "right", label: "Minutes" },
];

const TOPIC_COLUMNS: AdminTableColumn[] = [
  { label: "Topic" },
  { label: "Subject", size: "wide" },
  { label: "How often" },
  { label: "Why", size: "long" },
];

const FREQUENCY_LABELS: Record<TopicFrequencyLevel, string> = {
  high: "Often",
  low: "Rarely",
  medium: "Sometimes",
};

type TestConditions = NonNullable<ExamStructure["mock"]>;

/** "180 questions over 2 days", from what the notice says about the sitting. */
function testTitle(test: TestConditions): string {
  const days = new Set(test.sections.map((section) => section.day).filter(Boolean)).size;

  const parts = [
    test.totalQuestions === null ? null : formatCount(test.totalQuestions, "question"),
    days > 1 ? `over ${days} days` : null,
  ].filter(Boolean);

  return parts.length > 0 ? `The test: ${parts.join(" ")}` : "The test";
}

function ExamTest({ test }: { test: TestConditions | null }) {
  if (!test) {
    return (
      <AdminSection title="The test">
        <AdminSectionEmpty>The notice doesn&apos;t say how the test runs.</AdminSectionEmpty>
      </AdminSection>
    );
  }

  return (
    <AdminSection description={test.scoring.description} title={testTitle(test)}>
      <AdminTableColumns
        columns={SECTION_COLUMNS}
        emptyLabel="The notice doesn't split the test into parts."
        isEmpty={test.sections.length === 0}
      >
        {test.sections.map((section) => (
          <AdminTableRow key={`${section.day}-${section.name}`}>
            <TableCell>{section.day === null ? null : `Day ${section.day}`}</TableCell>
            <TableCell className="whitespace-normal">{section.name}</TableCell>
            <TableCell numeric>{section.questions?.toLocaleString("en")}</TableCell>
            <TableCell numeric>{section.minutes?.toLocaleString("en")}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}

/** Ranked by how many questions each subject gets, so the bars say where the exam's weight is. */
function ExamSubjects({ subjects }: { subjects: ExamStructure["subjects"] }) {
  const ranked = subjects.toSorted(
    (first, second) => (second.questions ?? 0) - (first.questions ?? 0),
  );

  return (
    <AdminSection title={`Subjects (${subjects.length})`}>
      {subjects.length > 0 ? (
        <BarList
          rows={ranked.map((subject) => ({
            display: subject.questions === null ? "—" : formatCount(subject.questions, "question"),
            key: subject.name,
            name: subject.name,
            note: formatCount(subject.topics.length, "topic"),
            value: subject.questions ?? 0,
          }))}
        />
      ) : (
        <AdminSectionEmpty>The notice lists no subjects.</AdminSectionEmpty>
      )}
    </AdminSection>
  );
}

function ExamTopicFrequency({ topics }: { topics: TopicFrequency }) {
  return (
    <AdminSection title="What comes up most">
      <AdminTableColumns
        columns={TOPIC_COLUMNS}
        emptyLabel="Nothing says yet which topics come up most."
        isEmpty={topics.length === 0}
      >
        {topics.map((topic) => (
          <AdminTableRow key={`${topic.subject}-${topic.topic}`}>
            <TableCell className="font-medium whitespace-normal">{topic.topic}</TableCell>
            <TableCell className="whitespace-normal">{topic.subject}</TableCell>
            <TableCell>{FREQUENCY_LABELS[topic.level]}</TableCell>
            <TableCell className="text-muted-foreground whitespace-normal">{topic.basis}</TableCell>
          </AdminTableRow>
        ))}
      </AdminTableColumns>
    </AdminSection>
  );
}

/** What Zoonk read from the notice: how the test runs, its subjects and what comes up most. */
export function ExamBlueprint({ exam }: { exam: AdminExam }) {
  const structure = examStructureSchema.safeParse(exam.structure).data;
  const topics = topicFrequencySchema.safeParse(exam.topicFrequency).data ?? [];

  return (
    <>
      <ExamTest test={structure?.mock ?? null} />
      <ExamSubjects subjects={structure?.subjects ?? []} />
      <ExamTopicFrequency topics={topics} />

      <AdminSection title="As stored">
        <div className="flex flex-col">
          <AdminJson label="Edition" value={exam.edition} />
          <AdminJson label="Structure" value={exam.structure} />
          <AdminJson label="Topic frequency" value={exam.topicFrequency} />
        </div>
      </AdminSection>
    </>
  );
}
