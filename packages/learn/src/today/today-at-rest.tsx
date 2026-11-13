import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";

export function TodayPageHeader({ title }: { title: string }) {
  return (
    <PageHeader>
      <PageHeaderContent className="w-full">
        <PageTitle>{title}</PageTitle>
      </PageHeaderContent>
    </PageHeader>
  );
}

/** Pausing a goal never swaps the page for another. */
/** `bottomBar` is the state's `BottomBar`, with its one way on. */
export function TodayAtRest({
  banner = null,
  bottomBar,
  clause,
  detail,
  icon,
  sentence,
  title,
}: {
  banner?: React.ReactNode;
  bottomBar: React.ReactNode;
  clause?: string;
  detail?: React.ReactNode;
  icon: React.ReactNode;
  sentence: string;
  title: string;
}) {
  return (
    <Page className="gap-5" data-slot="today-goal-at-rest">
      {banner}
      <TodayPageHeader title={title} />

      <div className="flex flex-col gap-4">
        <TodayStatusLine icon={icon}>
          <TodayStatusSentence>{sentence}</TodayStatusSentence>
          {clause && <TodayStatusClause>{clause}</TodayStatusClause>}
        </TodayStatusLine>

        {detail}
      </div>

      {bottomBar}
    </Page>
  );
}
