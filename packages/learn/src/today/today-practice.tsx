"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { CompletedLessonsRow } from "../completed-lessons/completed-lessons-row";
import { MistakesRow } from "../mistakes/mistakes-row";

const PRACTICE_TITLE_ID = "today-practice-title";

/**
 * Under 72rem only: from there the sidebar's study links and the command palette hold the same ways
 * in.
 */
export function TodayPractice({
  className,
  completedLessons,
  completedLessonsHref,
  mistakes,
  mistakesHref,
  mockEntry,
  speakingEntry,
}: {
  className?: string;
  completedLessons: boolean;
  completedLessonsHref: string;
  mistakes: MistakeAvailability;
  mistakesHref: string;
  mockEntry?: React.ReactNode;
  speakingEntry?: React.ReactNode;
}) {
  const t = useExtracted();

  return (
    <PageSection
      aria-labelledby={PRACTICE_TITLE_ID}
      className={cn("has-[[data-slot=list-group]:empty]:hidden min-[72rem]:hidden", className)}
      data-slot="today-practice"
    >
      <PageSectionHeader>
        <PageSectionTitle id={PRACTICE_TITLE_ID}>{t("Practice anytime")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {mockEntry}
        {speakingEntry}
        <MistakesRow availability={mistakes} href={mistakesHref} />
        {completedLessons && <CompletedLessonsRow href={completedLessonsHref} />}
      </ListGroup>
    </PageSection>
  );
}
