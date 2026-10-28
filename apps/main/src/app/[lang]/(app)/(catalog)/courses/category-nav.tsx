"use client";

import { Link } from "@/i18n/navigation";
import { SubjectGlyph } from "@zoonk/learn/subject-label";
import { buttonVariants } from "@zoonk/ui/components/button";
import { HorizontalScroll, HorizontalScrollContent } from "@zoonk/ui/components/horizontal-scroll";
import { cn } from "@zoonk/ui/lib/utils";
import { type CourseCategory } from "@zoonk/utils/categories";
import { useExtracted, useLocale } from "next-intl";
import { useSelectedLayoutSegment } from "next/navigation";

type CategoryLink = { courseCount: number; key: CourseCategory; label: string };

const ROW_BLEED_CLASS = "-mx-4 sm:-mx-0";
const ROW_INSET_CLASS = "px-4 sm:px-0";

const CHIPS_FRAME_CLASS =
  "bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-(--catalog-bar) z-20 -my-2 py-2 backdrop-blur lg:hidden";

const LIST_FRAME_CLASS = "sticky top-8 hidden self-start lg:block";

const LIST_LINK_CLASS =
  "text-muted-foreground hover:bg-muted/50 hover:text-foreground aria-[current=page]:bg-muted aria-[current=page]:text-foreground focus-visible:ring-ring/50 hit-area relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[0.84375rem] font-medium outline-none transition-colors focus-visible:ring-[3px]";

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
  const locale = useLocale();

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
            className={ROW_INSET_CLASS}
            role="navigation"
          >
            {links.map((link) => (
              <Link
                aria-current={link.current ? "page" : undefined}
                className={cn(
                  buttonVariants({ size: "sm", variant: link.current ? "default" : "outline" }),
                  "scroll-mx-16",
                )}
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
        <ul className="flex flex-col gap-0.5">
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
