"use client";

import { Link } from "@/i18n/navigation";
import { useAppLocale } from "@zoonk/learn/locale";
import { SubjectGlyph } from "@zoonk/learn/subject-label";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { TAB_CLASS, TAB_LIST_CLASS } from "@zoonk/ui/components/tab-class";
import { cn } from "@zoonk/ui/lib/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { useExtracted } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

type CategoryLink = { courseCount: number; key: CourseCategory; label: string };

/** A tab's fill starts 10 px before its label, so the row starts that much early and the labels start on the column. */
const ROW_BLEED_CLASS = "-mx-4 [--scroll-inset:--spacing(1.5)] sm:-mx-2.5 sm:[--scroll-inset:0px]";

const CHIPS_FRAME_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-(--catalog-bar) z-20 -my-2 py-2 backdrop-blur lg:hidden";

const LIST_FRAME_CLASS = "sticky top-8 hidden self-start lg:block";

const LIST_LINK_CLASS = cn(TAB_CLASS, "h-8 gap-2.5");

function revealChip(chip: HTMLAnchorElement | null) {
  chip?.scrollIntoView({ block: "nearest", inline: "nearest" });
}

type CategoryNavProps = { categories: CategoryLink[]; openCategory: string | null; total: number };

/**
 * An empty category would only lead to "Start a goal", which the goal box already offers; one opened
 * from a link stays listed while it's the page.
 */
function useCategoryLinks({ categories, openCategory, total }: CategoryNavProps) {
  const t = useExtracted();
  const locale = useAppLocale();

  return [
    {
      courseCount: total,
      current: openCategory === null,
      href: "/courses" as const,
      key: "all",
      label: t("All"),
      subject: null,
    },
    ...categories
      .filter((category) => category.courseCount > 0 || category.key === openCategory)
      .toSorted((a, b) => a.label.localeCompare(b.label, locale))
      .map((category) => ({
        courseCount: category.courseCount,
        current: openCategory === category.key,
        href: `/courses/${category.key}` as const,
        key: category.key,
        label: category.label,
        subject: category.key,
      })),
  ];
}

function CategoryNavView(props: CategoryNavProps) {
  const t = useExtracted();
  const links = useCategoryLinks(props);

  return (
    <>
      <div className={CHIPS_FRAME_CLASS}>
        <HorizontalScroll
          className={ROW_BLEED_CLASS}
          labels={{ left: t("Scroll left"), right: t("Scroll right") }}
        >
          <HorizontalScrollContent
            aria-label={t("Course categories")}
            className={TAB_LIST_CLASS}
            role="navigation"
          >
            {links.map((link) => (
              <Link
                aria-current={link.current ? "page" : undefined}
                className={cn(TAB_CLASS, "scroll-mx-16")}
                href={link.href}
                key={link.key}
                prefetch
                ref={link.current ? revealChip : undefined}
              >
                {link.subject && <SubjectGlyph subject={link.subject} />}
                {link.label}
              </Link>
            ))}
          </HorizontalScrollContent>
        </HorizontalScroll>
      </div>

      <nav aria-label={t("Course categories")} className={LIST_FRAME_CLASS}>
        <ul className="-mx-2.5 flex flex-col gap-0.5">
          {links.map((link) => (
            <li key={link.key}>
              <Link
                aria-current={link.current ? "page" : undefined}
                className={LIST_LINK_CLASS}
                href={link.href}
                prefetch
              >
                {link.subject ? (
                  <SubjectGlyph subject={link.subject} />
                ) : (
                  <span aria-hidden="true" className="size-2 shrink-0" />
                )}
                <span className="truncate">{link.label}</span>
                <span className="text-muted-foreground ml-auto pl-3 font-mono text-xs tabular-nums">
                  {link.courseCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

/** Every category's page is a static route of its own, so the chosen one is known as the page renders. */
export function CategoryNav(props: Omit<CategoryNavProps, "openCategory">) {
  return <CategoryNavView {...props} openCategory={useSelectedLayoutSegment()} />;
}
