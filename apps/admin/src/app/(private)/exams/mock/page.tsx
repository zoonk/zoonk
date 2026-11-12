import { type Dump, Facts, FactsFrom, MockRows, day, field, readView } from "@/app/(private)/_mock/kit";
import blueprint from "@/app/(private)/_mock/data/exam-enem-blueprint.json";
import dump from "@/app/(private)/_mock/data/exam-enem.json";
import { MockMenu } from "@/app/(private)/_mock/menu";
import {
  AdminDetailBody,
  AdminDetailColumns,
  AdminDetailHeader,
  AdminDetailPage,
} from "@/components/admin-detail";
import { AdminSection, AdminSectionEmpty } from "@/components/admin-section";
import { AdminTabs } from "@/components/admin-tabs";
import { Button } from "@zoonk/ui/components/button";
import { BookOpenTextIcon, CircleStopIcon, RefreshCwIcon, RotateCcwIcon } from "lucide-react";
import { MockLink, MockMore } from "../../_mock/parts";

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Blueprint", value: "blueprint" },
  { label: "Skill graph", value: "graph" },
  { label: "Written by", value: "written" },
  { label: "Details", value: "details" },
] as const;

const exam = dump as Dump;
const { graph, structure, topicFrequency } = blueprint;

const ACTIONS = [
  {
    confirm: {
      confirmLabel: "Read again",
      description:
        "Zoonk reads the official notice with today's instructions. What changes reaches learners of this exam.",
      title: "Read the notice of ENEM again?",
    },
    icon: <BookOpenTextIcon aria-hidden="true" />,
    label: "Read notice again",
  },
  {
    confirm: {
      confirmLabel: "Reset",
      description:
        "The skill graph is discarded. The next learner who adds this exam writes a new one.",
      destructive: true,
      title: "Reset the skill graph of ENEM?",
    },
    icon: <RotateCcwIcon aria-hidden="true" />,
    label: "Reset skill graph",
  },
  {
    confirm: {
      confirmLabel: "Stop checking",
      description:
        "Zoonk stops looking for changes to it. Checks start again when a learner's goal needs it.",
      title: "Stop checking ENEM?",
    },
    icon: <CircleStopIcon aria-hidden="true" />,
    label: "Stop checking",
  },
];

const FREQUENCY: Record<string, string> = { high: "Often", low: "Rarely", medium: "Sometimes" };

function Overview() {
  return (
    <AdminDetailColumns
      aside={
        <>
          <AdminSection title="Checking">
            <Facts
              rows={[
                ["Official notice", <MockLink key="notice">{field(exam, "Source")}</MockLink>],
                ["Next check", "Nov 19, 2026"],
              ]}
            />
          </AdminSection>

          <AdminSection title="In use">
            <Facts
              rows={[
                ["Goals", field(exam, "Goals")],
                ["Practice questions", <MockLink key="items">{field(exam, "Items")}</MockLink>],
                ["Skill graph", `${field(exam, "Skills")} skills`],
              ]}
            />
          </AdminSection>
        </>
      }
    >
      <AdminSection title="This edition">
        <Facts
          rows={[
            ["Exam date", day(field(exam, "Exam date"))],
            ["Registration ends", day(field(exam, "Registration ends"))],
          ]}
        />
      </AdminSection>

      <AdminSection title="What changed">
        <AdminSectionEmpty>No change since the notice was first read.</AdminSectionEmpty>
      </AdminSection>
    </AdminDetailColumns>
  );
}

function Blueprint() {
  return (
    <>
      <AdminSection
        action={<MockMore>Show JSON</MockMore>}
        title={`The test: ${structure.mock.totalQuestions} questions over ${structure.mock.sections.length} days`}
      >
        <MockRows
          columns={[
            { label: "Day" },
            { label: "Part" },
            { align: "right", label: "Questions" },
            { align: "right", label: "Minutes" },
          ]}
          rows={structure.mock.sections.map((section) => [
            `Day ${section.day}`,
            section.name,
            section.questions,
            section.minutes,
          ])}
        />
      </AdminSection>

      <AdminSection title={`Subjects (${structure.subjects.length})`}>
        <MockRows
          columns={[{ label: "Subject" }, { align: "right", label: "Questions" }, { label: "Topics" }]}
          rows={structure.subjects.map((subject) => [
            subject.name,
            subject.questions ?? "—",
            `${subject.topics.length} topics`,
          ])}
        />
      </AdminSection>

      <AdminSection title="What comes up most">
        <MockRows
          columns={[{ label: "Topic" }, { label: "Subject" }, { label: "How often" }, { label: "Why" }]}
          rows={topicFrequency.map((topic) => [
            topic.topic,
            topic.subject,
            FREQUENCY[topic.level] ?? topic.level,
            <span className="block max-w-md" key="why">
              {topic.basis}
            </span>,
          ])}
        />
      </AdminSection>
    </>
  );
}

const SHOWN_SKILLS = 12;

function SkillGraph() {
  return (
    <AdminSection action={<MockMore>Show JSON</MockMore>} title={`Skills (${graph.skills.length})`}>
      <MockRows
        columns={[
          { label: "Skill" },
          { label: "Area" },
          { align: "right", label: "Weight" },
          { align: "right", label: "Lessons" },
        ]}
        rows={graph.skills
          .slice(0, SHOWN_SKILLS)
          .map((skill) => [
            <MockLink key="skill">{skill.name}</MockLink>,
            skill.area,
            skill.weight,
            skill.lessons,
          ])}
      />
      <MockMore>Show all {graph.skills.length} skills</MockMore>
    </AdminSection>
  );
}

function WrittenBy() {
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <AdminSection title="Blueprint">
        <FactsFrom dump={exam} rename={{ Generated: "Written" }} section="Provenance" />
      </AdminSection>
      <AdminSection title="Skill graph">
        <FactsFrom dump={exam} omit={["Skills"]} rename={{ Generated: "Written" }} section="Skill graph" />
      </AdminSection>
    </div>
  );
}

function Details() {
  return (
    <AdminSection title="Details">
      <Facts
        rows={[
          ["Identity key", field(exam, "Identity key")],
          ["Good until", field(exam, "Valid until")],
          ["Created", field(exam, "Created")],
          ["Updated", field(exam, "Updated")],
        ]}
      />
    </AdminSection>
  );
}

const BODIES: Record<string, () => React.ReactNode> = {
  blueprint: Blueprint,
  details: Details,
  graph: SkillGraph,
  written: WrittenBy,
};

export default async function ExamMockPage({ searchParams }: PageProps<"/exams/mock">) {
  const tab = readView((await searchParams).tab) || "overview";
  const Body = BODIES[tab] ?? Overview;

  return (
    <AdminDetailPage>
      <AdminDetailHeader
        actions={
          <Button size="lg" variant="outline">
            <RefreshCwIcon aria-hidden="true" />
            Check now
          </Button>
        }
        facts={["Checked Nov 12, 2026", "Inep", "Brazil", "Portuguese"]}
        menu={<MockMenu actions={ACTIONS} label="Exam actions" />}
        parents={[{ href: "/exams", label: "Exams" }]}
        title="ENEM"
      />

      <AdminDetailBody>
        <AdminTabs current={tab as "overview"} label="Exam" path="/exams/mock" tabs={TABS} />
        <Body />
      </AdminDetailBody>
    </AdminDetailPage>
  );
}
