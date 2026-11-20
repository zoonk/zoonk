"use client";

import { BottomBar, BottomBarActions } from "@zoonk/ui/components/bottom-bar";
import { EnterLink } from "@zoonk/ui/components/enter-button";
import { DocumentLink } from "@zoonk/ui/patterns/links/pending";

export function ReturnToZoonk({ children, href }: { children: string; href: string }) {
  return (
    <div className="mt-auto w-full [--page-measure:360px]">
      <BottomBar className="mx-auto">
        <BottomBarActions>
          <EnterLink href={href} link={DocumentLink} size="lg">
            {children}
          </EnterLink>
        </BottomBarActions>
      </BottomBar>
    </div>
  );
}
