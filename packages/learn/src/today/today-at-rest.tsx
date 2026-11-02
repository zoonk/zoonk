import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { TodayEyebrow, TodayEyebrowPart } from "./today-heading";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";

export function TodayPageHeader({
  date,
  state,
  title,
}: {
  date: string | null;
  state?: string;
  title: string;
}) {
  return (
    <PageHeader>
      <PageHeaderContent className="w-full">
        {(date || state) && (
          <TodayEyebrow>
            {date && <span>{date}</span>}
            {state && <TodayEyebrowPart>{state}</TodayEyebrowPart>}
          </TodayEyebrow>
        )}
        <PageTitle>{title}</PageTitle>
      </PageHeaderContent>
    </PageHeader>
  );
}

/** Pausing a goal never swaps the page for another. */
export function TodayAtRest({
  actions,
  clause,
  date,
  detail,
  icon,
  sentence,
  state,
  title,
}: {
  actions: React.ReactNode;
  clause: string;
  date: string | null;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  sentence: string;
  state: string;
  title: string;
}) {
  return (
    <Page className="gap-5" data-slot="today-goal-at-rest">
      <TodayPageHeader date={date} state={state} title={title} />

      <div className="flex flex-col gap-4">
        <TodayStatusLine icon={icon}>
          <TodayStatusSentence>{sentence}</TodayStatusSentence>
          <TodayStatusClause>{clause}</TodayStatusClause>
        </TodayStatusLine>

        {detail}

        <div className="flex items-start gap-2 [&>*:first-child]:flex-1 sm:[&>*:first-child]:flex-none">
          {actions}
        </div>
      </div>
    </Page>
  );
}
