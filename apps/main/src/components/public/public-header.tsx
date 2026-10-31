import { PublicBarAccount, PublicBarStart } from "./public-bar-learner";
import { PublicNavLinks } from "./public-nav-links";
import { PublicHomeLink, PublicTopBar } from "./public-top-bar";
import { PublicVisitorActions } from "./public-visitor-actions";

/** Static: a visitor's bar is in the HTML, and the learner summary in the browser swaps in a learner's. */
export function PublicHeader() {
  return (
    <PublicTopBar
      actions={
        <>
          <PublicNavLinks />
          <PublicBarAccount visitor={<PublicVisitorActions />} />
        </>
      }
      start={<PublicBarStart visitor={<PublicHomeLink />} />}
    />
  );
}
