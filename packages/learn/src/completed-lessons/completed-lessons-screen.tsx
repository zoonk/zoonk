"use client";

import {
  COMPLETED_LESSON_PAGE_SIZE,
  type CompletedLesson,
  type CompletedLessonFilter,
} from "@zoonk/core/completed-lessons/contract";
import { Button } from "@zoonk/ui/components/button";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { useExtracted } from "next-intl";
import { useState } from "react";
import { DetailAsideSection, DetailContent, DetailLayout } from "../_components/detail-page";
import {
  LIST_GROUP_CLASS,
  ListRowBody,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
  ListRowTrailing,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { PageTab, PageTabsColumn, PageTabsGroup, PageTabsScroll } from "../_components/page-tabs";
import { useFormatIsoDate } from "../_utils/iso-date";
import { LearnPageBar } from "../shell/learn-bar";

export type CompletedLessonsHrefs = {
  back: string;
  /** The page with only one group's lessons; null is every lesson. */
  group: (key: string | null) => string;
  lesson: (lessonId: string) => string;
};

const GROUPS_TITLE_ID = "completed-lessons-groups";

const MONTH_LENGTH = "YYYY-MM".length;

function groupByMonth(lessons: readonly CompletedLesson[]) {
  return [...Map.groupBy(lessons, (lesson) => lesson.finishedOn.slice(0, MONTH_LENGTH)).entries()];
}

function useGroupsTitle(kind: CompletedLessonFilter["kind"]): string {
  const t = useExtracted();

  if (kind === "subjects") {
    return t("Subjects");
  }

  return kind === "modules" ? t("Modules") : t("Phases");
}

function LessonRow({ href, lesson }: { href: string; lesson: CompletedLesson }) {
  const formatDate = useFormatIsoDate();

  return (
    <ListRowLink href={href} lessonWritten prefetch="intent">
      <ListRowBody>
        <ListRowContent>
          <ListRowTitle>{lesson.title}</ListRowTitle>
          {lesson.chapterTitle && <ListRowDescription>{lesson.chapterTitle}</ListRowDescription>}
        </ListRowContent>
        <ListRowTrailing>{formatDate(lesson.finishedOn)}</ListRowTrailing>
      </ListRowBody>
    </ListRowLink>
  );
}

/** Each lesson's day ends its row, so a month's lessons read as one list however few a day has. */
function MonthSection({
  hrefs,
  lessons,
  month,
}: {
  hrefs: CompletedLessonsHrefs;
  lessons: readonly CompletedLesson[];
  month: string;
}) {
  const formatDate = useFormatIsoDate();
  const titleId = `completed-lessons-${month}`;

  return (
    <PageSection aria-labelledby={titleId}>
      <PageSectionHeader>
        <PageSectionTitle className="first-letter:uppercase" id={titleId}>
          {formatDate(`${month}-01`, "sentenceMonth")}
        </PageSectionTitle>
      </PageSectionHeader>

      <ul className={LIST_GROUP_CLASS}>
        {lessons.map((lesson) => (
          <li key={lesson.lessonId}>
            <LessonRow href={hrefs.lesson(lesson.lessonId)} lesson={lesson} />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

/** The list switches on the page, which already holds every lesson, so nothing loads or moves. */
function showGroup(href: string) {
  globalThis.history.pushState(null, "", href);
}

function GroupTabs({
  current,
  filter,
  hrefs,
  row = false,
}: {
  current: string | null;
  filter: CompletedLessonFilter;
  hrefs: CompletedLessonsHrefs;
  row?: boolean;
}) {
  const t = useExtracted();

  const tabs: { key: string | null; lessons: number; name: string }[] = [
    {
      key: null,
      lessons: filter.total,
      name: t({
        description:
          "The first choice of the filter on Completed lessons, before the subjects: every lesson.",
        id: "completedLessonsAll",
        message: "All",
      }),
    },
    ...filter.groups,
  ];

  return tabs.map((tab) => (
    <PageTab
      count={tab.lessons}
      current={tab.key === current}
      href={hrefs.group(tab.key)}
      key={tab.key ?? ""}
      onSelect={() => showGroup(hrefs.group(tab.key))}
      row={row}
    >
      {tab.name}
    </PageTab>
  ));
}

/** A new group starts from its newest lessons again. */
function LessonMonths({
  hrefs,
  lessons,
}: {
  hrefs: CompletedLessonsHrefs;
  lessons: readonly CompletedLesson[];
}) {
  const t = useExtracted();
  const [shown, setShown] = useState(COMPLETED_LESSON_PAGE_SIZE);

  return (
    <>
      {groupByMonth(lessons.slice(0, shown)).map(([month, monthLessons]) => (
        <MonthSection hrefs={hrefs} key={month} lessons={monthLessons} month={month} />
      ))}

      {lessons.length > shown && (
        <Button
          className="self-start"
          onClick={() => setShown(shown + COMPLETED_LESSON_PAGE_SIZE)}
          variant="outline"
        >
          {t("Show more")}
        </Button>
      )}
    </>
  );
}

export function CompletedLessonsScreen({
  filter,
  group,
  hrefs,
  lessons,
}: {
  filter: CompletedLessonFilter | null;
  /** The group in the page's address, which picking one changes in place. */
  group: string | null;
  hrefs: CompletedLessonsHrefs;
  lessons: readonly CompletedLesson[];
}) {
  const t = useExtracted();
  const groupsTitle = useGroupsTitle(filter?.kind ?? "subjects");
  const current = filter?.groups.find((candidate) => candidate.key === group)?.key ?? null;
  const listed = current ? lessons.filter((lesson) => lesson.group === current) : lessons;

  const list = (
    <DetailContent>
      {lessons.length === 0 && (
        <p className="text-muted-foreground text-sm">
          {t("Lessons you finish show up here, so you can do them again anytime.")}
        </p>
      )}

      <LessonMonths hrefs={hrefs} key={current} lessons={listed} />
    </DetailContent>
  );

  return (
    <DetailLayout
      aside={
        filter && (
          <DetailAsideSection title={groupsTitle} titleId={GROUPS_TITLE_ID}>
            <PageTabsColumn label={groupsTitle}>
              <GroupTabs current={current} filter={filter} hrefs={hrefs} row />
            </PageTabsColumn>
          </DetailAsideSection>
        )
      }
      asideClassName="max-[72rem]:hidden"
      asideLabel={groupsTitle}
      bar={
        <LearnPageBar
          back={{ href: hrefs.back }}
          // The sidebar lists the page once a lesson is done: the same runs this list reads.
          listed={lessons.length > 0 ? "learner" : undefined}
          root
          title={t("Completed lessons")}
        />
      }
      data-slot="completed-lessons"
      measure="list"
    >
      <DetailHero>
        <DetailHeroText>
          <DetailTitle>{t("Completed lessons")}</DetailTitle>
        </DetailHeroText>
      </DetailHero>

      {filter ? (
        <PageTabsGroup className="min-[72rem]:mt-0">
          <PageTabsScroll className="min-[72rem]:hidden" label={groupsTitle}>
            <GroupTabs current={current} filter={filter} hrefs={hrefs} />
          </PageTabsScroll>
          {list}
        </PageTabsGroup>
      ) : (
        list
      )}
    </DetailLayout>
  );
}
