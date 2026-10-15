import {
  LEGACY_SESSION_HINT,
  SESSION_HINT_COOKIE,
  SESSION_HINT_TAG_PATTERN,
} from "@zoonk/auth/session-hint";

const HINT_PREFIX = `${SESSION_HINT_COOKIE}=`;

/**
 * Runs before any bundle, so it carries its own copy of `describeSessionHint`'s "session" (a
 * learner's tag, or `1` from before tags), built from the same values, on the cookie read by name.
 */
const SCRIPT = [
  `{const v=(document.cookie.split("; ").find((c)=>c.startsWith(${JSON.stringify(HINT_PREFIX)}))??"").slice(${HINT_PREFIX.length});`,
  `document.documentElement.toggleAttribute("data-signed-in",v===${JSON.stringify(LEGACY_SESSION_HINT)}||${String(SESSION_HINT_TAG_PATTERN)}.test(v))}`,
].join("");

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
      dangerouslySetInnerHTML={{ __html: SCRIPT }}
    />
  );
}
