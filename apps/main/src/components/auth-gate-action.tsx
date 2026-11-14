"use client";

import { EnterLink } from "@zoonk/learn/enter-button";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";

/**
 * The gate's one way in, the main action Enter presses. Logging in leaves for the sign-in site, so
 * it loads a document, and it needs nothing from the learning frame, which a signed-out page lacks.
 * `href` is the login page's localized path.
 */
export function AuthGateAction({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <EnterLink href={href} link={DocumentLink}>
      {children}
    </EnterLink>
  );
}
