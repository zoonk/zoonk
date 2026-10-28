import { FallbackPageBar } from "./_components/fallback-page-bar";
import { LearnNotFound } from "./_components/learn-not-found";

export default function NotFound() {
  return <LearnNotFound bar={<FallbackPageBar />} />;
}
