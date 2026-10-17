import { FallbackPageBar } from "./_components/fallback-page-bar";
import { LearnNotFound } from "./_components/learn-not-found";

/** A page of the app that isn't there, shown by the browser where a page threw `notFound()`. */
export default function NotFound() {
  return <LearnNotFound bar={<FallbackPageBar />} />;
}
