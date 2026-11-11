import { PublicNotFound } from "@/components/public/public-not-found";

/**
 * Next renders the root not-found into every page under it, cache tags included, so the footer's
 * course lists would expire every page whenever a course is written.
 */
export default function NotFound() {
  return <PublicNotFound exploreLinks={false} />;
}
