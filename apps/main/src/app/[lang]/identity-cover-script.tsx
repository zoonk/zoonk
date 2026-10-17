import {
  IDENTITY_COVER_ID,
  bootIdentityCover,
  buildIdentityCoverPlane,
  readIdentityCoverHint,
  readIdentityResetGuard,
} from "@/lib/learner/identity-cover-boot";
import {
  IDENTITY_RESET_GUARD_KEY,
  decideIdentityReset,
  parseIdentityResetGuard,
} from "@/lib/learner/identity-reset-guard";
import { toScriptJson } from "@/lib/learner/script-json";
import {
  NO_SESSION_HINT,
  SESSION_HINT_COOKIE,
  SESSION_HINT_TAG_PATTERN,
} from "@zoonk/auth/session-hint";
import { buttonVariants } from "@zoonk/ui/components/button";
import { getExtracted } from "next-intl/server";

/**
 * The cover's placement, before any stylesheet loads: one opaque plane over everything, outside
 * `<body>`, with nothing that animates or fades it, and a page under it that can't scroll.
 */
const COVER_STYLE = [
  `#${IDENTITY_COVER_ID}{display:none}`,
  "html[data-zoonk-cover]{overflow:hidden;overscroll-behavior:none}",
  `html[data-zoonk-cover]>#${IDENTITY_COVER_ID}{display:block;position:fixed;inset:-50vh -50vw;z-index:2147483647;background:var(--background,Canvas);color-scheme:light dark;color:CanvasText}`,
  `#${IDENTITY_COVER_ID}>[role=alertdialog]{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1rem;text-align:center;outline:none;padding:max(1.5rem,env(safe-area-inset-top)) max(1.5rem,env(safe-area-inset-right)) max(1.5rem,env(safe-area-inset-bottom)) max(1.5rem,env(safe-area-inset-left))}`,
].join("");

/**
 * The identity cover's parse-time bootstrap (`bootIdentityCover`), in every page's `<head>` next
 * to the session hint's script: it's in place before any private region paints, and it reads no
 * session, so the page stays static. Its words come in the page's language.
 */
export async function IdentityCoverScript() {
  const t = await getExtracted();

  const config = {
    buttonClassName: {
      primary: buttonVariants({ size: "lg" }),
      secondary: buttonVariants({ size: "lg", variant: "outline" }),
    },
    copy: {
      checking: t("Checking your account…"),
      failed: t("Couldn't check your account"),
      outOfDate: t("This page is out of date"),
      reload: t("Reload"),
      tryAgain: t("Try again"),
    },
    coverId: IDENTITY_COVER_ID,
    guardKey: IDENTITY_RESET_GUARD_KEY,
    hint: {
      cookie: SESSION_HINT_COOKIE,
      none: NO_SESSION_HINT,
      tag: { flags: SESSION_HINT_TAG_PATTERN.flags, source: SESSION_HINT_TAG_PATTERN.source },
    },
    labelClassName: {
      checking: "text-muted-foreground max-w-md text-sm text-balance",
      message: "text-foreground max-w-md text-base font-medium text-balance",
    },
  };

  const parts = [
    `buildPlane:${buildIdentityCoverPlane.toString()}`,
    `decideReset:${decideIdentityReset.toString()}`,
    `parseGuard:${parseIdentityResetGuard.toString()}`,
    `readGuard:${readIdentityResetGuard.toString()}`,
    `readHint:${readIdentityCoverHint.toString()}`,
  ].join(",");

  return (
    <>
      <style>{COVER_STYLE}</style>
      <script
        // oxlint-disable-next-line react/no-danger -- A fixed script that must run before the first paint.
        dangerouslySetInnerHTML={{
          __html: `(${bootIdentityCover.toString()})(${toScriptJson(config)},{${parts}})`,
        }}
      />
    </>
  );
}
