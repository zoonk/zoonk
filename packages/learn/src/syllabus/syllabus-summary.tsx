"use client";

import { type SyllabusSubject, type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
  DrawerTrigger,
} from "@zoonk/ui/components/drawer";
import { ChevronDownIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useFormatDuration } from "../_utils/time-format";
import { type SubjectGroup, groupSubjects } from "./group-subjects";
import { SubjectIcon } from "./subject-icon";
import { CourseWeightsNote, PassMarks, QuestionsSourceNote, useGroupName } from "./syllabus-notes";
import { hasSyllabusSection } from "./syllabus-section";
import { SummaryTopics } from "./syllabus-summary-topics";

/**
 * The topics the plan leaves out, and whether all of them are out only for lack of time. A
 * subject's basics the learner starts past aren't left out: the plan counts them as known.
 */
function countLeftOut(syllabus: SyllabusView): { forTime: boolean; leftOut: number } {
  const topics = syllabus.subjects.flatMap((subject) => subject.topics);

  const out = topics.filter(
    (topic) => topic.status === "notPlanned" && topic.notPlannedReason !== "pastBasics",
  );

  return {
    forTime: out.length > 0 && out.every((topic) => topic.notPlannedReason === "time"),
    leftOut: out.length,
  };
}

/** "Ética 8 · Civil 7 · Constitucional 6": the subjects that weigh most, for a notice without topics. */
function useHeaviestSubjects(syllabus: SyllabusView): string | null {
  const t = useExtracted();
  const subjects = syllabus.subjects.filter((subject) => subject.source === "notice");
  const counted = subjects.filter((subject) => subject.questions !== null);

  if (counted.length === 0 || counted.length < subjects.length) {
    return null;
  }

  const heaviest = counted
    .slice(0, 3)
    .map((subject) => `${subject.shortName} ${subject.questions}`)
    .join(" · ");

  return t("Most questions: {subjects}", { subjects: heaviest });
}

/** What the plan leaves out: "18 of 70 topics don't fit in 2h a day", or that all of it is in. */
function useCoverageLine({
  dailyMinutes,
  syllabus,
}: {
  dailyMinutes: number | null;
  syllabus: SyllabusView;
}): string {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const total = syllabus.topicCount;
  const { forTime, leftOut } = countLeftOut(syllabus);

  if (leftOut === 0) {
    return t(
      "{count, plural, one {# topic, all in your plan} other {# topics, all in your plan}}",
      { count: total },
    );
  }

  if (forTime && dailyMinutes !== null) {
    return t(
      "{leftOut, number} of {total, plural, one {# topic doesn't} other {# topics don't}} fit in {time} a day",
      { leftOut, time: formatDuration(dailyMinutes), total },
    );
  }

  return t("{planned, number} of {total, plural, one {# topic} other {# topics}} in your plan", {
    planned: total - leftOut,
    total,
  });
}

/**
 * "9 subjects from the notice" and what the plan leaves out ("18 of 70 topics don't fit in 2h a
 * day"); "6 topics from your material" for a class test; "6 modules" for other goals.
 */
function useSummaryLines({
  dailyMinutes,
  syllabus,
}: {
  dailyMinutes: number | null;
  syllabus: SyllabusView;
}): { detail: string | null; title: string } {
  const t = useExtracted();
  const heaviest = useHeaviestSubjects(syllabus);
  const coverage = useCoverageLine({ dailyMinutes, syllabus });
  const noticeSubjects = syllabus.subjects.filter((subject) => subject.source === "notice").length;

  const firstSubjects = syllabus.subjects
    .slice(0, 2)
    .map((subject) => subject.shortName)
    .join(" · ");

  if (syllabus.kind !== "notice") {
    return {
      detail: firstSubjects,
      title: t("{count, plural, one {# module} other {# modules}}", {
        count: syllabus.subjects.length,
      }),
    };
  }

  // The learner's material is never called a notice: a material that lists only headings (a
  // teacher's "Teoria celular, Organelas…") counts those as its topics.
  if (syllabus.fromMaterial) {
    const title = t(
      "{count, plural, one {# topic from your material} other {# topics from your material}}",
      { count: syllabus.topicCount > 0 ? syllabus.topicCount : noticeSubjects },
    );

    if (syllabus.topicCount === 0) {
      return { detail: firstSubjects, title };
    }

    return { detail: syllabus.topicsMapped ? coverage : null, title };
  }

  const title = t(
    "{count, plural, one {# subject from the notice} other {# subjects from the notice}}",
    { count: noticeSubjects },
  );

  // A notice that names its subjects without listing their topics (the OAB's 1ª fase).
  if (syllabus.topicCount === 0) {
    return { detail: heaviest ?? firstSubjects, title };
  }

  if (!syllabus.topicsMapped) {
    return {
      detail: t("{count, plural, one {# topic} other {# topics}}", { count: syllabus.topicCount }),
      title,
    };
  }

  return { detail: coverage, title };
}

/** Up to three subject icons, overlapping, as the card's anchor. */
function IconStack({ subjects }: { subjects: readonly SyllabusSubject[] }) {
  return (
    <span aria-hidden="true" className="flex shrink-0 -space-x-3">
      {subjects.slice(0, 3).map((subject) => (
        <span className="ring-card rounded-xl ring-2" key={subject.key}>
          <SubjectIcon imageUrl={subject.imageUrl} />
        </span>
      ))}
    </span>
  );
}

/** "8 questions · 7 topics, 2 out of your plan": what a subject weighs and what the plan leaves out. */
function useSubjectLine(subject: SyllabusSubject): string | null {
  const t = useExtracted();
  const total = subject.topics.length;
  const leftOut = subject.topics.filter((topic) => topic.status === "notPlanned").length;

  const topics =
    leftOut > 0
      ? t("{total, plural, one {# topic} other {# topics}}, {leftOut, number} out of your plan", {
          leftOut,
          total,
        })
      : total > 0 && t("{total, plural, one {# topic} other {# topics}}", { total });

  const questions =
    subject.questions !== null &&
    subject.questions > 0 &&
    t("{count, plural, one {# question} other {# questions}}", { count: subject.questions });

  const parts = [questions, topics].filter((part) => typeof part === "string");
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** A subject in the sheet: its name, opening in place to its topics as the notice lists them. */
function SummarySubject({ subject }: { subject: SyllabusSubject }) {
  const line = useSubjectLine(subject);

  const header = (
    <>
      <SubjectIcon imageUrl={subject.imageUrl} size="sm" />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm leading-snug font-medium">{subject.name}</span>
        {line && <span className="text-muted-foreground text-xs">{line}</span>}
      </span>
    </>
  );

  if (subject.topics.length === 0) {
    return <div className="flex min-h-12 items-center gap-3 py-2">{header}</div>;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="group/subject hover:bg-muted/60 focus-visible:ring-ring/50 -mx-2 flex min-h-12 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2 text-left outline-none focus-visible:ring-[3px]">
        {header}
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground size-4 shrink-0 transition-transform group-data-panel-open/subject:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <SummaryTopics topics={subject.topics} />
      </CollapsibleContent>
    </Collapsible>
  );
}

function SummaryGroup({ fromMaterial, group }: { fromMaterial: boolean; group: SubjectGroup }) {
  const name = useGroupName({ fromMaterial, group });

  return (
    <div className="flex flex-col gap-1">
      {name && (
        <h3 className="text-muted-foreground pt-2 text-xs font-medium tracking-wide uppercase">
          {name}
        </h3>
      )}
      <ul className="flex flex-col">
        {group.subjects.map((subject) => (
          <li key={subject.key}>
            <SummarySubject subject={subject} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function SummaryCard({
  dailyMinutes,
  syllabus,
}: {
  dailyMinutes: number | null;
  syllabus: SyllabusView;
}) {
  const t = useExtracted();
  const lines = useSummaryLines({ dailyMinutes, syllabus });
  const groups = groupSubjects(syllabus.subjects, { modules: syllabus.kind === "modules" });

  return (
    <Drawer>
      <DrawerTrigger
        className="bg-card hover:bg-muted/40 focus-visible:ring-ring/50 flex w-full items-center gap-4 rounded-3xl border p-4 text-left shadow-xs transition-colors outline-none focus-visible:ring-[3px]"
        data-slot="syllabus-summary"
      >
        <IconStack subjects={syllabus.subjects} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">{lines.title}</span>
          {lines.detail && <span className="text-muted-foreground text-sm">{lines.detail}</span>}
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
        <span className="sr-only">{t("See them all")}</span>
      </DrawerTrigger>

      <DrawerPopup>
        <DrawerHeader className="flex-row items-center justify-between gap-3">
          <DrawerTitle className="text-xl font-semibold">{t("What you'll study")}</DrawerTitle>
          <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
            <XIcon aria-hidden="true" />
            <span className="sr-only">{t("Close")}</span>
          </DrawerClose>
        </DrawerHeader>
        <DrawerContent className="flex flex-col gap-2 pt-1">
          {groups.map((group) => (
            <SummaryGroup
              fromMaterial={syllabus.fromMaterial}
              group={group}
              key={group.extra ? "extra" : (group.name ?? "all")}
            />
          ))}
          <QuestionsSourceNote source={syllabus.questionsSource} />
          <CourseWeightsNote subjects={syllabus.subjects} weights={syllabus.courseWeights} />
        </DrawerContent>
      </DrawerPopup>
    </Drawer>
  );
}

/**
 * The goal's structure at the moment the plan is revealed: "9 subjects from the notice" with what
 * the plan leaves out at the learner's time (or "6 modules") on one card, opening a sheet with
 * every subject, what it weighs and its topics in the notice's own words, the ones left out marked,
 * so the learner sees it's all there before starting; and what it takes to pass, once.
 */
export function SyllabusSummary({
  dailyMinutes = null,
  syllabus,
}: {
  /** The learner's time a day, so what doesn't fit says at which time. */
  dailyMinutes?: number | null;
  syllabus: SyllabusView | null;
}) {
  if (!hasSyllabusSection(syllabus)) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <SummaryCard dailyMinutes={dailyMinutes} syllabus={syllabus} />
      <PassMarks passMarks={syllabus.passMarks} />
    </div>
  );
}
