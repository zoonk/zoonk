"use client";

import { useExtracted } from "next-intl";
import { ListGroup } from "../_components/list-group";
import { PageSection, PageSectionHeader, PageSectionTitle } from "../_components/page";
import { MistakesRow } from "../mistakes/mistakes-row";
import { useTodayScreen } from "./today-context";

const PRACTICE_TITLE_ID = "today-practice-title";

/**
 * What the learner can practice whenever they want, beyond the day's session: a mock exam (marked
 * Plus when their plan doesn't include mocks) and the mistakes notebook. The section leaves itself
 * out when neither has anything to offer.
 */
export function TodayPractice({
  mistakes,
  mockEntry,
}: {
  /** Open entries in the mistakes notebook. */
  mistakes: number;
  mockEntry: React.ReactNode;
}) {
  const t = useExtracted();
  const { actions } = useTodayScreen();

  return (
    <PageSection
      aria-labelledby={PRACTICE_TITLE_ID}
      className="has-[[data-slot=list-group]:empty]:hidden"
    >
      <PageSectionHeader>
        <PageSectionTitle id={PRACTICE_TITLE_ID}>{t("Practice anytime")}</PageSectionTitle>
      </PageSectionHeader>

      <ListGroup>
        {mockEntry}
        <MistakesRow count={mistakes} href={actions.mistakesHref} />
      </ListGroup>
    </PageSection>
  );
}
