import { cn } from "@zoonk/ui/lib/utils";
import { type ReactNode } from "react";
import { PUBLIC_COLUMN_CLASS, PublicPage } from "./public-page";

/** Headings clear the sticky top bar when a link jumps to one. */
export function LegalDocument({
  children,
  pathname,
}: {
  children: ReactNode;
  pathname: "/privacy" | "/terms";
}) {
  return (
    <PublicPage pathname={pathname}>
      <article
        className={cn(
          PUBLIC_COLUMN_CLASS,
          "prose prose-neutral dark:prose-invert prose-headings:scroll-mt-20 prose-headings:tracking-[-0.015em] prose-h1:text-[30px] prose-h1:leading-[1.1] prose-h1:font-[620] prose-h1:tracking-[-0.035em] prose-h2:text-lg max-w-[704px] pt-6 pb-24 sm:pt-10",
        )}
      >
        {children}
      </article>
    </PublicPage>
  );
}
