"use client";

import { EnterLink } from "@zoonk/learn/enter-button";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";

/**
 * A screen's main action, the one Enter presses, as a link that loads a document: sign-in leaves for
 * another site, and the home page is reached from screens outside the learning frame, whose links
 * this needs nothing from.
 */
export function MainDocumentLink({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <EnterLink href={href} link={DocumentLink}>
      {children}
    </EnterLink>
  );
}
