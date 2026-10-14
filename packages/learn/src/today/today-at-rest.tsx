import { Page, PageHeader, PageHeaderContent, PageTitle } from "../_components/page";
import { TodayEyebrow, TodayEyebrowPart } from "./today-heading";
import { TodayStatusClause, TodayStatusLine, TodayStatusSentence } from "./today-status-line";

/**
 * Today's title under its date line when there's no day to show yet (no goal, a paused one): the
 * same header as the day's, so the page keeps its frame. The date is the learner's day when the
 * host knows it; `state` ends the line ("Paused").
 */
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

/**
 * Today when the goal the tabs show has no day to study: it's paused or finished. Today's own
 * header ("· Paused" ending the date line), one status line ("ENEM 2027 is paused. Nothing is
 * planned until you resume it."), what the way on would do when it changes something (`detail`:
 * resuming a goal whose pause left lessons behind) and the ways on, the main one first: side by
 * side, the main one widest on a phone. Pausing a goal never swaps the page for another.
 */
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
