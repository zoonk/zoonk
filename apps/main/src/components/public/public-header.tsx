import { LoginBarLink } from "@/components/login-bar-link";
import { PublicBarAccount, PublicBarStart } from "./public-bar-learner";
import { PublicNavLinks } from "./public-nav-links";
import { PublicHomeLink, PublicTopBar } from "./public-top-bar";
import { PublicVisitorActions } from "./public-visitor-actions";

/** Static: a visitor's bar is in the HTML, and the learner summary in the browser swaps in a learner's. */
export function PublicHeader({
  hideStart,
  ownStart,
  pathname,
}: {
  hideStart?: boolean;
  ownStart?: boolean;
  pathname?: string;
}) {
  return (
    <PublicTopBar
      actions={
        <PublicBarAccount
          visitor={
            hideStart ? <LoginBarLink edge="end" /> : <PublicVisitorActions ownStart={ownStart} />
          }
        />
      }
      nav={<PublicNavLinks pathname={pathname} />}
      start={<PublicBarStart visitor={<PublicHomeLink />} />}
    />
  );
}
