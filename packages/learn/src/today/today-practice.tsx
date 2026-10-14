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
 * What the learner can practice whenever they want, beyond the day's session: a mock exam or a
 * language goal's exam-style speaking (each marked Plus when the plan doesn't include it) and the
 * mistakes notebook. Under 72rem only: from there the sidebar's study links and the command
 * palette hold the same ways in, so the aside stays glanceable. The section leaves itself out when
 * none has anything to offer.
 */
export function TodayPractice({
  className,
  mistakes,
  mockEntry,
  speakingEntry,
}: {
  className?: string;
  /** Open entries in the mistakes notebook. */
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
