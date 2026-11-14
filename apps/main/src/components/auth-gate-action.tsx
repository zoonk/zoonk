"use client";

import { Link } from "@/i18n/navigation";
import { EnterLink } from "@zoonk/learn/enter-button";

/** The gate's one way in, the main action Enter presses. `href` is already the login page's own. */
export function AuthGateAction({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <EnterLink href={href} link={Link}>
      {children}
    </EnterLink>
  );
}
