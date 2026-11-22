"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { EnterLink, type EnterLinkHostProps } from "@zoonk/ui/components/enter-button";

function AnchorLink({ children, ...props }: EnterLinkHostProps) {
  return <a {...props}>{children}</a>;
}

/** A page's main action when it goes to another page, pinned in the bottom bar. */
export function MainActionBar({ children, href }: { children: React.ReactNode; href: string }) {
  return (
    <BottomBar>
      <BottomBarActions>
        <EnterLink href={href} link={AnchorLink}>
          {children}
        </EnterLink>
      </BottomBarActions>
    </BottomBar>
  );
}
