import { VisitorCommandPalette } from "@/app/[lang]/(learn)/_components/visitor-command-palette";
import { MainLearnProvider } from "@/components/learn/main-learn-provider";
import { getSession } from "@zoonk/core/users/session";
import { LearnShell } from "@zoonk/learn/shell";
import { Suspense } from "react";
import { SectionBarFrame, type SectionHub, SectionMain } from "./section-layout";

type SectionFrameProps = {
  /** One action of the section's, on the right of its bar. */
  end?: React.ReactNode;
  /** The way home instead of the way back, for a section whose page names itself (the catalog). */
  home?: boolean;
  /**
   * The section's first page and its pages' sidebar, for a section of several pages (settings,
   * statistics): the hub is a page of its own, and every page under it goes back to it.
   */
  hub?: SectionHub;
  wide?: boolean;
};

/**
 * Without an app page to return to (the section opened from a link or a reload), the way back
 * leads to Today, or to the home page for a visitor; so does the way home.
 */
async function SectionBar(
  props: Omit<SectionFrameProps, "hub"> & { hub?: Omit<SectionHub, "nav"> },
) {
  const session = await getSession();
  return <SectionBarFrame {...props} backHref={session ? "/today" : "/"} />;
}

/**
 * A section of the app (settings, statistics, the course catalog): its own bar in place of the
 * app's (the way back and one action), over the page, without the tab bar. A section of several
 * pages opens on its hub (a list of its pages, or the statistics' overview); each page under it
 * goes back to the hub, and from `lg` keeps the section's pages in a sidebar beside it. The page is
 * the app's column, or as wide as the screen (`wide`) for a grid.
 */
export function SectionFrame({
  children,
  hub,
  ...bar
}: SectionFrameProps & { children: React.ReactNode }) {
  const hubLink = hub && { href: hub.href, title: hub.title };

  return (
    <MainLearnProvider>
      <LearnShell className="overflow-x-clip">
        <Suspense fallback={<SectionBarFrame {...bar} backHref="/today" hub={hubLink} />}>
          <SectionBar {...bar} hub={hubLink} />
        </Suspense>

        <SectionMain hub={hub} wide={bar.wide}>
          {children}
        </SectionMain>

        <Suspense fallback={null}>
          <VisitorCommandPalette />
        </Suspense>
      </LearnShell>
    </MainLearnProvider>
  );
}
