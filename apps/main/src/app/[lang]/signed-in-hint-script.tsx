import { SESSION_HINT, SESSION_HINT_COOKIE } from "@zoonk/auth/session-hint";

const SIGNED_IN = `${SESSION_HINT_COOKIE}=${SESSION_HINT}`;

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
