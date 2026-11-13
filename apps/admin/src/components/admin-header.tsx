import { BackLink, PageTop } from "@zoonk/ui/components/page-top";
import Link from "next/link";
import { AdminBarMenuButton, AdminBarSearchButton } from "./admin-bar-buttons";

export type AdminParent = { href: string; label: string };

/** The page's side room, which the bar reads to reach the frame's edges. */
const PAGE_GUTTER_CLASS =
  "px-4 [--page-gutter:1rem] sm:px-8 sm:[--page-gutter:2rem] lg:px-10 lg:[--page-gutter:2.5rem]";

/**
 * The top of every Admin page, list or record, on the shared page top: a bar with the way back to
 * the page it belongs to and the page's own actions, then the title and what `children` says about
 * it. Where the sidebar is hidden the bar also opens the menu and search.
 */
export function AdminHeader({
  actions,
  children,
  parent,
  title,
}: {
  /** `Button size="bar"` and a record's `AdminBarMenu`. */
  actions?: React.ReactNode;
  children?: React.ReactNode;
  /** The list a record belongs to. A list page has none. */
  parent?: AdminParent;
  title: React.ReactNode;
}) {
  return (
    <div className={PAGE_GUTTER_CLASS} data-slot="admin-header">
      <PageTop
        actions={
          <>
            {actions}
            <AdminBarSearchButton />
          </>
        }
        back={
          <>
            <AdminBarMenuButton />
            {parent ? (
              <BackLink
                aria-label={`Back to ${parent.label}`}
                render={<Link href={parent.href} prefetch />}
              >
                {parent.label}
              </BackLink>
            ) : null}
          </>
        }
      >
        {title}
        {children}
      </PageTop>
    </div>
  );
}
