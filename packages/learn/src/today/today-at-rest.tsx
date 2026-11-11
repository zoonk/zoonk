import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { TodayEyebrow, TodayEyebrowPart } from "./today-heading";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";

export function TodayPageHeader({ state, title }: { state?: string; title: string }) {
  return (
    <PageHeader>
      <PageHeaderContent className="w-full">
        {state && (
          <TodayEyebrow>
            <TodayEyebrowPart>{state}</TodayEyebrowPart>
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
  banner = null,
  clause,
  detail,
  icon,
  sentence,
  state,
  title,
}: {
  actions: React.ReactNode;
  banner?: React.ReactNode;
  clause: string;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  sentence: string;
  state: string;
  title: string;
}) {
  return (
    <Page className="gap-5" data-slot="today-goal-at-rest">
      {banner}
      <TodayPageHeader state={state} title={title} />

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
