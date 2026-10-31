"use client";

import { type MistakeAvailability } from "@zoonk/core/mistakes/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { MistakesRow } from "../mistakes/mistakes-row";
import { useTodayScreen } from "./today-context";

const PRACTICE_TITLE_ID = "today-practice-title";

/**
 * Under 72rem only: from there the sidebar's study links and the command palette hold the same ways
 * in.
 */
export function TodayPractice({
  className,
  mistakes,
  mockEntry,
  speakingEntry,
}: {
  className?: string;
  mistakes: MistakeAvailability;
  mockEntry: React.ReactNode;
  speakingEntry: React.ReactNode;
}) {
  const t = useExtracted();
  const { actions } = useTodayScreen();

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
        <MistakesRow availability={mistakes} href={actions.mistakesHref} />
      </ListGroup>
    </PageSection>
  );
}
