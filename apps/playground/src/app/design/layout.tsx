import { type Metadata } from "next";
import { SiteNav } from "../_components/site-nav";
import { DesignNav } from "./_components/design-nav";
import { ModeStyles } from "./_components/mode-styles";

export const metadata: Metadata = {
  title: { default: "Design system", template: "%s · Design system | Zoonk Playground" },
};

/**
 * Zoonk's design system: what every token, type role, shape and pattern means, beside live
 * specimens and the tokens' values in every mode, read from `globals.css`. Its words live in
 * `src/design-system/`, so agents read the same source.
 */
export default function DesignLayout({ children }: LayoutProps<"/design">) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-6 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm font-semibold">Zoonk design system</p>
        <SiteNav current="design" />
      </header>

      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <DesignNav />
        <main className="min-w-0">{children}</main>
      </div>

      <ModeStyles />
    </div>
  );
}
