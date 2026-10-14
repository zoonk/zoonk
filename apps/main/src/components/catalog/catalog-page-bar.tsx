import { VisitorBarLinks } from "@/components/login-bar-link";
import { getSession } from "@zoonk/core/users/session";
import { LearnPageBar } from "@zoonk/learn/bar";
import { Suspense } from "react";

/**
 * Pricing and the way into an account for anyone without one (a visitor, or a guest who tried a
 * lesson), in the bar under `lg`, where the sidebar's aren't.
 */
async function VisitorLinks() {
  const session = await getSession();
  const hasAccount = Boolean(session && !session.user.isAnonymous);

  return hasAccount ? null : <VisitorBarLinks className="lg:hidden" />;
}

/**
 * The bar of a course's, a chapter's or a lesson's page in the catalog, as every page opened from
 * another has it: the way back (Explore courses, the course, the chapter), named as a breadcrumb
 * from `lg`, the page's options and, for a visitor, Pricing and the way into an account.
 */
export function CatalogPageBar({
  back,
  options,
  title,
}: {
  back: { href: string; label: string };
  /** The page's "…" menu. */
  options?: React.ReactNode;
  /** The page's name, beside the way back from `lg`; a page that isn't there has none. */
  title?: string;
}) {
  return (
    <LearnPageBar back={back} title={title}>
      {options}

      <Suspense fallback={null}>
        <VisitorLinks />
      </Suspense>
    </LearnPageBar>
  );
}
