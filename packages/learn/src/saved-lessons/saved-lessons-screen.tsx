"use client";

import { type SavedLesson } from "@zoonk/core/saved-lessons/contract";
import { Button } from "@zoonk/ui/components/button";
import { DetailHero, DetailHeroText, DetailTitle } from "@zoonk/ui/components/detail";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { useId, useState } from "react";
import { DetailContent, DetailLayout } from "../_components/detail-page";
import {
  LIST_GROUP_CLASS,
  LIST_ROW_CLASS,
  ListRowContent,
  ListRowDescription,
  ListRowLinkWithAction,
  ListRowTitle,
} from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { useKeptRows } from "../saves/use-kept-rows";
import { LearnPageBar } from "../shell/learn-bar";
import { LessonSaveButton } from "./lesson-save-button";
import { type LessonSaves, type SaveLesson, useLessonSaves } from "./use-lesson-saves";

export type { SaveLesson } from "./use-lesson-saves";

export type SavedLessonsHrefs = { back: string; lesson: (lessonId: string) => string };

const SHOWN_AT_ONCE = 50;

function SavedLessonRow({
  href,
  lesson,
  saves,
}: {
  href: string;
  lesson: SavedLesson;
  saves: LessonSaves;
}) {
  const state = { saved: true, target: lesson.lessonId };

  return (
    <ListRowLinkWithAction
      action={
        <LessonSaveButton
          edge="end"
          labelled={false}
          onToggle={() => saves.toggle(state)}
          saved={saves.isSaved(state)}
          size="icon-lg"
          title={lesson.title}
          variant="ghost"
        />
      }
      href={href}
      lessonWritten
      prefetch="intent"
    >
      <ListRowContent>
        <ListRowTitle>{lesson.title}</ListRowTitle>
        {lesson.chapterTitle && <ListRowDescription>{lesson.chapterTitle}</ListRowDescription>}
      </ListRowContent>
    </ListRowLinkWithAction>
  );
}

/** It can't be saved again, so removing it takes the row away at once. */
function UnavailableLessonRow({ lesson, onRemove }: { lesson: SavedLesson; onRemove: () => void }) {
  const t = useExtracted();

  return (
    <div className={cn(LIST_ROW_CLASS, "items-center")} data-slot="unavailable-lesson-row">
      <ListRowContent>
        <ListRowTitle>{lesson.title}</ListRowTitle>
        {lesson.chapterTitle && <ListRowDescription>{lesson.chapterTitle}</ListRowDescription>}
      </ListRowContent>
      <Button
        aria-label={t({
          description: "What screen readers say for Remove, naming the lesson.",
          message: "Remove {title} from saved lessons",
          values: { title: lesson.title },
        })}
        onClick={onRemove}
        size="sm"
        variant="outline"
      >
        {t("Remove")}
      </Button>
    </div>
  );
}

function Unavailable({ lessons, saves }: { lessons: readonly SavedLesson[]; saves: LessonSaves }) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <PageSection aria-labelledby={titleId}>
      <PageSectionHeader>
        <PageSectionTitle id={titleId}>{t("No longer available")}</PageSectionTitle>
      </PageSectionHeader>
      <ul className={LIST_GROUP_CLASS}>
        {lessons.map((lesson) => (
          <li key={lesson.lessonId}>
            <UnavailableLessonRow
              lesson={lesson}
              onRemove={() => saves.toggle({ saved: true, target: lesson.lessonId })}
            />
          </li>
        ))}
      </ul>
    </PageSection>
  );
}

export function SavedLessonsScreen({
  hrefs,
  lessons,
  save,
}: {
  hrefs: SavedLessonsHrefs;
  /** Newest save first. */
  lessons: readonly SavedLesson[];
  save: SaveLesson;
}) {
  const t = useExtracted();
  const saves = useLessonSaves(save);
  const [shown, setShown] = useState(SHOWN_AT_ONCE);

  // A save that can no longer open has no bookmark to tap again, so its Remove takes it away.
  const rows = useKeptRows({
    isKept: (lesson) => lesson.available && saves.isTouched(lesson.lessonId),
    isSaved: (lesson) => saves.isSaved({ saved: true, target: lesson.lessonId }),
    keyOf: (lesson) => lesson.lessonId,
    rows: lessons,
  });

  const open = rows.filter((lesson) => lesson.available);
  const gone = rows.filter((lesson) => !lesson.available);

  return (
    <DetailLayout
      bar={
        <LearnPageBar
          back={{ href: hrefs.back }}
          // The sidebar lists the page while the goal has a save: the list this page was served.
          listed={lessons.length > 0 ? "learner" : undefined}
          root
          title={t("Saved lessons")}
        />
      }
      data-slot="saved-lessons"
      measure="list"
    >
      <DetailHero>
        <DetailHeroText>
          <DetailTitle>{t("Saved lessons")}</DetailTitle>
        </DetailHeroText>
      </DetailHero>

      <DetailContent>
        {open.length === 0 && gone.length === 0 && (
          <p className="text-muted-foreground text-sm">
            {t("Nothing saved yet. Tap the bookmark on a lesson to keep it here.")}
          </p>
        )}

        {open.length > 0 && (
          <ul aria-label={t("Saved lessons")} className={LIST_GROUP_CLASS}>
            {open.slice(0, shown).map((lesson) => (
              <li key={lesson.lessonId}>
                <SavedLessonRow
                  href={hrefs.lesson(lesson.lessonId)}
                  lesson={lesson}
                  saves={saves}
                />
              </li>
            ))}
          </ul>
        )}

        {open.length > shown && (
          <Button
            className="self-start"
            onClick={() => setShown(shown + SHOWN_AT_ONCE)}
            variant="outline"
          >
            {t("Show more")}
          </Button>
        )}

        {gone.length > 0 && <Unavailable lessons={gone} saves={saves} />}
      </DetailContent>
    </DetailLayout>
  );
}
