"use client";

import {
  type NotPlannedReason,
  type SyllabusChapter,
  type SyllabusTopic,
} from "@zoonk/core/view-models/syllabus/contract";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, ChevronDownIcon, ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_INTERACTIVE_CLASS,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSectionLabel } from "../_components/page";
import { LearnLink } from "../learn-link";
import { FrequencyChip, setsApart } from "./frequency-chip";
import { TopicMark, type TopicMarkState } from "./topic-mark";
import { type TopicGroup, groupTopics } from "./topic-number";
import { TopicNumber } from "./topic-number-label";

/** Deeper sub-items ("1.1.1") sit one more step in. */
const CHILD_INDENT = ["", "pl-0", "pl-5", "pl-10"] as const;

type Group = TopicGroup<SyllabusTopic>;

/** Every topic of a group: the item itself, then the ones numbered under it. */
function groupItems(group: Group): SyllabusTopic[] {
  return [group.topic, ...group.children.map((child) => child.topic)];
}

/** The chapters that teach any of a group's topics, each once, in the order they first come. */
function getGroupChapters(group: Group): SyllabusChapter[] {
  const chapters = groupItems(group).flatMap((topic) => topic.chapters);
  const keys = chapters.map((chapter) => chapter.chapterId ?? chapter.title);

  return chapters.filter((_, index) => keys.indexOf(keys[index] ?? "") === index);
}

function getChaptersShare(chapters: readonly SyllabusChapter[]): number {
  const total = chapters.reduce((sum, chapter) => sum + chapter.lessonsTotal, 0);
  const done = chapters.reduce((sum, chapter) => sum + chapter.lessonsDone, 0);

  return total > 0 ? done / total : 0;
}

function getTopicMark(topic: SyllabusTopic): TopicMarkState | null {
  if (topic.status === null) {
    return null;
  }

  if (topic.status === "inProgress") {
    return { kind: "inProgress", share: getChaptersShare(topic.chapters) };
  }

  return { kind: topic.status };
}

/**
 * A group's mark from its topics: out of the plan when all of them are, a check once every planned
 * one is studied, a ring of how much of it is studied once it's begun, else to study.
 */
function getGroupMark(topics: readonly SyllabusTopic[]): TopicMarkState | null {
  if (topics.some((topic) => topic.status === null)) {
    return null;
  }

  const planned = topics.filter((topic) => topic.status !== "notPlanned");
  const studied = planned.filter((topic) => topic.status === "studied").length;
  const begun = planned.filter((topic) => topic.status === "inProgress").length;

  if (planned.length === 0) {
    return { kind: "notPlanned" };
  }

  if (studied === planned.length) {
    return { kind: "studied" };
  }

  if (studied + begun === 0) {
    return { kind: "toStudy" };
  }

  return { kind: "inProgress", share: (studied + begun / 2) / planned.length };
}

function useStatusText() {
  const t = useExtracted();

  return (mark: TopicMarkState | null): string => {
    if (!mark) {
      return "";
    }

    switch (mark.kind) {
      case "studied":
        return t(", studied");
      case "inProgress":
        return t(", in progress");
      case "notPlanned":
        return t(", not in your plan");
      case "toStudy":
        return t(", to study");
      default:
        return mark satisfies never;
    }
  };
}

/** Why a topic isn't in the plan, in a few words under its name. */
function ReasonText({ reason }: { reason: NotPlannedReason | null }) {
  const t = useExtracted();

  if (!reason) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {reason === "skipped" && t("You took this subject out of your plan")}
      {reason === "pastBasics" && t("You start past the basics")}
      {reason === "time" && t("Doesn't fit in the time you have")}
      {reason === "missing" && t("No lessons on it yet")}
    </span>
  );
}

/** A chapter that teaches a topic, one line under it, opening the chapter's page. */
function TopicChapterLink({
  chapter,
  chapterHref,
}: {
  chapter: SyllabusChapter;
  chapterHref: (chapterId: string) => string;
}) {
  const t = useExtracted();

  const content = (
    <>
      <BookOpenIcon aria-hidden="true" className="size-4 shrink-0" />
      <span className="line-clamp-2 min-w-0 flex-1 py-1">{chapter.title}</span>
    </>
  );

  if (!chapter.chapterId) {
    return (
      <span className="text-muted-foreground flex min-h-11 items-center gap-2 text-sm">
        {content}
        <span className="shrink-0 text-xs">{t("Lessons on the way")}</span>
      </span>
    );
  }

  return (
    <LearnLink
      className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 -mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm transition-colors outline-none focus-visible:ring-[3px]"
      href={chapterHref(chapter.chapterId)}
    >
      {content}
      <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0" />
    </LearnLink>
  );
}

function TopicChapters({
  chapterHref,
  chapters,
}: {
  chapterHref: (chapterId: string) => string;
  chapters: readonly SyllabusChapter[];
}) {
  return (
    <ul className="flex flex-col">
      {chapters.map((chapter) => (
        <li key={chapter.chapterId ?? chapter.title}>
          <TopicChapterLink chapter={chapter} chapterHref={chapterHref} />
        </li>
      ))}
    </ul>
  );
}

/** A sub-item inside its open group: its tick and words, and why it's out. */
function ChildTopic({ child }: { child: Group["children"][number] }) {
  const statusText = useStatusText();
  const mark = getTopicMark(child.topic);

  return (
    <li className={cn("flex gap-3 py-2", CHILD_INDENT[Math.min(child.depth, 3)])}>
      <span className="flex h-5 items-center">
        <TopicMark mark={mark} small />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className={cn("text-sm", mark?.kind === "notPlanned" && "text-muted-foreground")}>
          <TopicNumber number={child.number} />
          {child.text}
          <span className="sr-only">{statusText(mark)}</span>
        </span>
        <ReasonText reason={child.topic.notPlannedReason} />
      </div>
    </li>
  );
}

/** "2/5": how many of a group's topics are studied, for groups with items under them. */
function GroupCount({ group }: { group: Group }) {
  const t = useExtracted();
  const topics = groupItems(group);

  if (group.children.length === 0 || topics.some((topic) => topic.status === null)) {
    return null;
  }

  const studied = topics.filter((topic) => topic.status === "studied").length;

  return (
    <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
      <span aria-hidden="true">{`${studied}/${topics.length}`}</span>
      <span className="sr-only">
        {t(
          "{total, plural, one {{done, number} of # topic studied} other {{done, number} of # topics studied}}",
          { done: studied, total: topics.length },
        )}
      </span>
    </span>
  );
}

/** "Appears a lot" for an item past exams asked most, or one numbered under it. */
function getGroupFrequency(group: Group): SyllabusTopic["frequency"] {
  return groupItems(group).some((topic) => topic.frequency === "high") ? "high" : null;
}

/**
 * A group's own line: its mark, its words (why it's out, when it is), "Appears a lot" when past
 * exams asked it most (`showFrequency`) and its count.
 */
function GroupLine({ group, showFrequency }: { group: Group; showFrequency: boolean }) {
  const statusText = useStatusText();
  const mark = getGroupMark(groupItems(group));

  return (
    <>
      <ListRowLeading>
        <TopicMark mark={mark} />
      </ListRowLeading>
      <ListRowContent className="min-h-12 py-2.5">
        <ListRowTitle className={cn(mark?.kind === "notPlanned" && "text-muted-foreground")}>
          <TopicNumber number={group.number} />
          {group.text}
          <span className="sr-only">{statusText(mark)}</span>
        </ListRowTitle>
        {group.children.length === 0 && <ReasonText reason={group.topic.notPlannedReason} />}
      </ListRowContent>
      <ListRowTrailing className="empty:hidden">
        {showFrequency && <FrequencyChip frequency={getGroupFrequency(group)} />}
        <GroupCount group={group} />
      </ListRowTrailing>
    </>
  );
}

/**
 * One item of the notice's outline: one line with its tick, opening in place to the items the
 * notice numbers under it and the chapters that teach each. An item with nothing to open is one
 * line.
 */
function TopicGroupRow({
  chapterHref,
  group,
  showFrequency,
}: {
  chapterHref: (chapterId: string) => string;
  group: Group;
  showFrequency: boolean;
}) {
  const chapters = getGroupChapters(group);

  if (group.children.length === 0 && chapters.length === 0) {
    return (
      <ListRow>
        <GroupLine group={group} showFrequency={showFrequency} />
      </ListRow>
    );
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className={cn(LIST_ROW_INTERACTIVE_CLASS, "group/topic")}>
        <GroupLine group={group} showFrequency={showFrequency} />
        <ChevronDownIcon
          aria-hidden="true"
          className="text-muted-foreground/60 size-4 shrink-0 self-center transition-transform group-data-panel-open/topic:rotate-180 motion-reduce:transition-none"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0 motion-reduce:transition-none">
        <div className="bg-muted/40 flex flex-col pr-4 pb-2 pl-13">
          {group.children.length > 0 && (
            <ul className="flex flex-col">
              {group.children.map((child) => (
                <ChildTopic child={child} key={child.topic.name} />
              ))}
            </ul>
          )}
          {chapters.length > 0 && (
            <div className={cn(group.children.length > 0 && "border-border/70 mt-1 border-t pt-1")}>
              <TopicChapters chapterHref={chapterHref} chapters={chapters} />
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** The subject's topics in runs under the notice's headings ("Física"), in its order. */
type HeadingRun = { heading: string | null; topics: SyllabusTopic[] };

function splitByHeading(topics: readonly SyllabusTopic[]): HeadingRun[] {
  const starts = topics.flatMap((topic, index) =>
    index === 0 || topic.heading !== topics[index - 1]?.heading ? [index] : [],
  );

  return starts.map((start, position) => ({
    heading: topics[start]?.heading ?? null,
    topics: topics.slice(start, starts[position + 1] ?? topics.length),
  }));
}

const getHeadingId = (index: number) => `subject-topics-heading-${index}`;

/**
 * A subject's topics as the notice's own outline, in its words, numbers and order: each top-level
 * item one line with its tick, opening to the items under it and the chapters that teach them.
 * Under the notice's own headings ("Física", "Química", "Biologia") when it has them, each a
 * label over its own list. "Appears a lot" marks the items past exams asked most, when it sets
 * some apart.
 */
export function SubjectTopics({
  chapterHref,
  labelledBy,
  topics,
}: {
  chapterHref: (chapterId: string) => string;
  labelledBy: string;
  topics: readonly SyllabusTopic[];
}) {
  const showFrequency = setsApart(topics);

  return splitByHeading(topics).map((run, index) => (
    <div className="flex flex-col gap-2" key={run.heading ?? `topics-${index}`}>
      {run.heading && <PageSectionLabel id={getHeadingId(index)}>{run.heading}</PageSectionLabel>}

      <ul
        aria-labelledby={run.heading ? getHeadingId(index) : labelledBy}
        className={LIST_GROUP_CLASS}
      >
        {groupTopics(run.topics).map((group) => (
          <li key={group.topic.name}>
            <TopicGroupRow chapterHref={chapterHref} group={group} showFrequency={showFrequency} />
          </li>
        ))}
      </ul>
    </div>
  ));
}
