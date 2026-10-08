import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PUBLIC_COLUMN_CLASS, PublicPage } from "./public-page";

/**
 * Terms and privacy read like the other public pages: the public top bar and footer, and the text
 * in the same reading column, so long lines stay comfortable on wide screens. Headings clear the
 * sticky top bar when a link jumps to one, like the pricing page's link to fair use.
 */
export function LegalDocument({ children }: { children: ReactNode }) {
  return (
    <PublicPage>
      <article
        className={cn(
          PUBLIC_COLUMN_CLASS,
          "prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20 prose-headings:tracking-[-0.015em] prose-h1:text-[30px] prose-h1:leading-[1.1] prose-h1:tracking-[-0.03em] sm:prose-h1:text-[44px] max-w-[704px] pt-6 pb-24 sm:pt-10",
        )}
      >
        {children}
      </article>
    </PublicPage>
  );
}
