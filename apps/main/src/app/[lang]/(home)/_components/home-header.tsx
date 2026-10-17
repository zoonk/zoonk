import { PublicNavLinks } from "@/components/public/public-nav-links";
import { PublicTopBar } from "@/components/public/public-top-bar";
import { PublicVisitorActions } from "@/components/public/public-visitor-actions";

/**
 * The visitor home page's top bar. It's static: anyone with a session opens Today instead. The
 * brain on the left; on the right the courses (from tablet widths) and pricing, a quiet "Log in"
 * at every width, and "Start free" from tablet widths (a phone's goal box is right under the bar,
 * and its bottom bar offers "Start free" once the box scrolls away).
 */
export function HomeHeader() {
  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          <PublicVisitorActions />
        </>
      }
    />
  );
}
