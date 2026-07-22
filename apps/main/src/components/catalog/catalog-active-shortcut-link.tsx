import { getActiveCatalogTarget } from "@/data/progress/get-catalog-target";
import { type LessonScope } from "@zoonk/core/lessons/scope";
import { type ActiveCatalogTarget } from "@zoonk/core/progress/continue-lesson-target";
import { type LessonKind } from "@zoonk/db";
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

const EMPTY_EXCLUDED_LESSON_KINDS: LessonKind[] = [];

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
  excludedLessonKinds = EMPTY_EXCLUDED_LESSON_KINDS,
  items,
  kind,
  scope,
}: {
  excludedLessonKinds?: LessonKind[];
  items: readonly CatalogActiveShortcutItem[];
  kind: CatalogActiveShortcutKind;
  scope: LessonScope;
}) {
  const activeTarget = await getActiveCatalogTarget({ excludedLessonKinds, scope });
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
