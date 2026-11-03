"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { daysBetweenIsoDays } from "@zoonk/utils/calendar-day";
import { useExtracted, useFormatter } from "next-intl";
import { DetailContent, DetailLayout } from "../_components/detail-page";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import {
  INBOX_PAGE_CLASS,
  PageEyebrow,
  PageSection,
  PageSectionHeader,
  PageSectionTitle,
} from "../_components/page";
import { LearnLink } from "../learn-link";
import { LearnPageBar } from "../shell/learn-bar";

export type CompletedLesson = {
  chapterTitle: string | null;
  finishedOn: string;
  lessonId: string;
  title: string;
};

export type CompletedLessonsHrefs = {
  back: string;
  lesson: (lessonId: string) => string;
  more: string | null;
};

function groupByDay(lessons: readonly CompletedLesson[]) {
  return [...Map.groupBy(lessons, (lesson) => lesson.finishedOn).entries()];
}

function readIsoDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

/** Both days are learner-local `YYYY-MM-DD`, read at UTC midnight so no time zone moves them. */
function useDayTitle(today: string) {
  const t = useExtracted();
  const format = useFormatter();

  return (day: string): string => {
    const daysAgo = daysBetweenIsoDays({ from: day, to: today });

    if (daysAgo === 0) {
      return t("Today");
    }

    if (daysAgo === 1) {
      return t("Yesterday");
    }

    const date = readIsoDay(day);
    const thisYear = date.getUTCFullYear() === readIsoDay(today).getUTCFullYear();

    return format.dateTime(date, {
      day: "numeric",
      month: "long",
      timeZone: "UTC",
      weekday: "long",
      ...(!thisYear && { year: "numeric" }),
    });
  };
}

function DaySection({
  day,
  hrefs,
  lessons,
  title,
}: {
  day: string;
  hrefs: CompletedLessonsHrefs;
  lessons: readonly CompletedLesson[];
  title: string;
}) {
  const titleId = `completed-lessons-${day}`;

  return (
    <PageSection aria-labelledby={titleId}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{title}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {lessons.map((lesson) => (
          <ListRowLink href={hrefs.lesson(lesson.lessonId)} key={lesson.lessonId} lessonWritten>
            <ListRowContent>
              <ListRowTitle>{lesson.title}</ListRowTitle>
              {lesson.chapterTitle && (
                <ListRowDescription>{lesson.chapterTitle}</ListRowDescription>
              )}
            </ListRowContent>
          </ListRowLink>
        ))}
      </ListGroup>
    </PageSection>
  );
}

export function CompletedLessonsScreen({
  goalTitle,
  hrefs,
  lessons,
  today,
}: {
  goalTitle: string;
  hrefs: CompletedLessonsHrefs;
  lessons: readonly CompletedLesson[];
  today: string;
}) {
  const t = useExtracted();
  const dayTitle = useDayTitle(today);

  return (
    <DetailLayout
      bar={<LearnPageBar back={{ href: hrefs.back }} root title={t("Completed lessons")} />}
      className={INBOX_PAGE_CLASS}
      data-slot="completed-lessons"
    >
      <DetailHero>
        <DetailHeroText>
          <PageEyebrow>{goalTitle}</PageEyebrow>
          <DetailTitle>{t("Completed lessons")}</DetailTitle>
        </DetailHeroText>
      </DetailHero>

      <DetailContent>
        {lessons.length === 0 && (
          <p className="text-muted-foreground text-sm text-pretty">
            {t("Lessons you finish show up here, so you can do them again anytime.")}
          </p>
        )}

        {groupByDay(lessons).map(([day, dayLessons]) => (
          <DaySection
            day={day}
            hrefs={hrefs}
            key={day}
            lessons={dayLessons}
            title={dayTitle(day)}
          />
        ))}

        {hrefs.more && (
          <LearnLink
            className={buttonVariants({ className: "self-start", variant: "outline" })}
            href={hrefs.more}
            scroll={false}
          >
            {t("Show more")}
          </LearnLink>
        )}
      </DetailContent>
    </DetailLayout>
  );
}
