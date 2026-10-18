import { type ReactNode } from "react";
import { PublicBarAccount, PublicBarStart } from "./public-bar-learner";
import { PublicNavLinks } from "./public-nav-links";
import { PublicHomeLink, PublicTopBar } from "./public-top-bar";
import { PublicVisitorActions } from "./public-visitor-actions";

/**
 * Public pages keep the top bar quiet so the page's one next step leads: on the left the brain
 * home (or, with a session, the goal switcher), and on the right the courses and pricing, the
 * page's options and an account action. The page is static: a visitor's bar is in its HTML, and
 * the learner summary in the browser swaps in a learner's.
 */
export function PublicHeader({ options }: { options?: ReactNode }) {
  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          {options}
          <PublicBarAccount visitor={<PublicVisitorActions />} />
        </>
      }
      start={<PublicBarStart visitor={<PublicHomeLink />} />}
    />
  );
}
