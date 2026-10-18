import { SESSION_HINT, SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";

/** The browser's session hint saying it holds a session, as `document.cookie` lists it. */
const SIGNED_IN = `${SESSION_HINT_COOKIE}=${SESSION_HINT}`;

/**
 * Marks `<html>` with `data-signed-in` before the first paint when the browser's session hint
 * says it holds a session, for the `signed-in:` variant (`globals.css`): a static page then shows
 * a learner a quiet place for their account instead of a visitor's way in until their learner
 * summary arrives. It only reads the cookie; without the hint (or with any other value) the page
 * keeps the visitor's look.
 */
export function SignedInHintScript() {
  return (
    <script
      // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
      dangerouslySetInnerHTML={{
        __html: `document.documentElement.toggleAttribute("data-signed-in",document.cookie.split("; ").includes(${JSON.stringify(SIGNED_IN)}))`,
      }}
    />
  );
}
