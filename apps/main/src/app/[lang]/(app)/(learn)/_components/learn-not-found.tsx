import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { NotFoundMessage } from "@/components/public/not-found-message";

const PLAN_PAGE_BAR = <JourneyPageBar />;

/**
 * The not-found boundary doesn't know the page, so it passes `FallbackPageBar`; a page names its bar
 * itself, so the frame's navigation code stays out of the page's scripts.
 */
export function LearnNotFound({ bar = PLAN_PAGE_BAR }: { bar?: React.ReactNode }) {
  return (
    <>
      {bar}
      <NotFoundMessage />
    </>
  );
}
