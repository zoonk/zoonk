import { PublicBarAccount, PublicBarStart } from "./public-bar-learner";
import { PublicNavLinks } from "./public-nav-links";
import { PublicHomeLink, PublicTopBar } from "./public-top-bar";
import { type PageStart, PublicVisitorActions } from "./public-visitor-actions";

/** Static: a visitor's bar is in the HTML, and the learner summary in the browser swaps in a learner's. */
export function PublicHeader({ ownStart }: { ownStart?: PageStart }) {
  return (
    <PublicTopBar
      actions={<PublicBarAccount visitor={<PublicVisitorActions ownStart={ownStart} />} />}
      nav={<PublicNavLinks />}
      start={<PublicBarStart visitor={<PublicHomeLink />} />}
    />
  );
}
