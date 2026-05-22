import { type ReactNode } from "react";

/**
 * Course and chapter detail pages need the same reading order on mobile, but a
 * split layout on desktop so the content identity stays visible while learners
 * scan the chapter or lesson list.
 */
export function CatalogDetailLayout({
  children,
  sidebar,
}: {
  children: ReactNode;
  sidebar: ReactNode;
}) {
  return (
    <main className="grid w-full flex-1 grid-cols-1 gap-6 px-4 pt-2 pb-8 md:pb-10 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)] lg:items-start lg:gap-8 xl:grid-cols-[minmax(18rem,22rem)_minmax(0,1fr)]">
      <aside className="flex min-w-0 flex-col gap-6 lg:sticky lg:top-20 lg:gap-4">{sidebar}</aside>
      <section className="min-w-0">{children}</section>
    </main>
  );
}
