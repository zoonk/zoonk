import { type LessonScope } from "@zoonk/core/lessons/last-completed";
import {
  type ActiveCatalogTarget,
  getActiveCatalogTarget,
} from "@zoonk/core/progress/active-catalog-target";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ArrowDownIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import {
  type CatalogGridItemKey,
  getCatalogActiveItemKey,
  getCatalogItemTargetId,
} from "./catalog-item-target";
import { CatalogSmoothScrollLink } from "./catalog-smooth-scroll-link";

type CatalogActiveShortcutKind = "chapter" | "lesson";
type CatalogActiveShortcutItem = { id: CatalogGridItemKey; slug: string };

/**
 * Course pages jump to chapters, while chapter pages jump to lessons. Keeping
 * that mapping named here prevents each page from reinterpreting the same
 * progress target differently.
 */
function getActiveShortcutSlug({
  activeTarget,
  kind,
}: {
  activeTarget: ActiveCatalogTarget | null;
  kind: CatalogActiveShortcutKind;
}) {
  if (!activeTarget) {
    return null;
  }

  if (kind === "chapter") {
    return activeTarget.chapterSlug;
  }

  return activeTarget.lessonSlug ?? null;
}

/**
 * The sidebar shortcut is a quiet icon-only anchor for learners who want to
 * jump to the next relevant tile without first scrolling far enough to reveal
 * the floating action.
 */
export async function CatalogActiveShortcutLink({
  items,
  kind,
  scope,
}: {
  items: readonly CatalogActiveShortcutItem[];
  kind: CatalogActiveShortcutKind;
  scope: LessonScope;
}) {
  const activeTarget = await getActiveCatalogTarget({ scope });
  const activeSlug = getActiveShortcutSlug({ activeTarget, kind });
  const activeItemKey = getCatalogActiveItemKey({ activeSlug, items });

  if (activeItemKey === null) {
    return null;
  }

  const t = await getExtracted();
  const label = kind === "chapter" ? t("Go to current chapter") : t("Go to current lesson");
  const targetId = getCatalogItemTargetId(activeItemKey);

  return (
    <CatalogSmoothScrollLink
      className={buttonVariants({ size: "icon", variant: "outline" })}
      targetId={targetId}
      title={label}
    >
      <ArrowDownIcon aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </CatalogSmoothScrollLink>
  );
}
