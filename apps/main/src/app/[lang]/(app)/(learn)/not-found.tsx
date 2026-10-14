import { NotFoundMessage } from "@/components/public/not-found-message";
import { FallbackPageBar } from "./_components/fallback-page-bar";

/**
 * A page of the app that isn't there (a subject or a chapter from an old link) says so inside the
 * app's frame, as a failed page does: the sidebar and the tabs stay, instead of swapping the whole
 * screen for the public 404 after the frame has painted.
 */
export default function NotFound() {
  return (
    <>
      <FallbackPageBar />
      <NotFoundMessage />
    </>
  );
}
