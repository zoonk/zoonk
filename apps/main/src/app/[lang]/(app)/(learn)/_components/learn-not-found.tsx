import { JourneyPageBar } from "@/components/learn/journey-page-bar";
import { NotFoundMessage } from "@/components/public/not-found-message";

/** The bar of a page opened from the Plan: its way back. */
const PLAN_PAGE_BAR = <JourneyPageBar />;

/**
 * A page of the app that isn't there (a subject or a chapter from an old link) says so inside the
 * app's frame, as a failed page does: the sidebar and the tabs stay, instead of swapping the whole
 * screen for the public 404 after the frame has painted. `bar` is the page's bar: a page opened
 * from the Plan keeps its way back (the default), and a tab's own page (Today) has none, since the
 * app bar is its own. The not-found boundary doesn't know the page, so it passes `FallbackPageBar`,
 * which picks one of them by the path; a page names its bar itself, so the frame's navigation code
 * stays out of the page's scripts.
 */
export function LearnNotFound({ bar = PLAN_PAGE_BAR }: { bar?: React.ReactNode }) {
  return (
    <>
      {bar}
      <NotFoundMessage />
    </>
  );
}
