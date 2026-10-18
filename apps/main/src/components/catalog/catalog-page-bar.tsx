import { VisitorBarLinks } from "@/components/login-bar-link";
import { NoAccountNote } from "@/components/public/no-account-note";
import { LearnPageBar } from "@zoonk/learn/bar";

/**
 * The bar of a course's, a chapter's or a lesson's page in the catalog, as every page opened from
 * another has it: the way back (Explore courses, the course, the chapter), named as a breadcrumb
 * from `lg`, the page's options and, for anyone without an account (a visitor, or a guest who tried
 * a lesson), Pricing and the way into an account under `lg`, where the sidebar's aren't.
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

      <NoAccountNote>
        <VisitorBarLinks className="lg:hidden" />
      </NoAccountNote>
    </LearnPageBar>
  );
}
