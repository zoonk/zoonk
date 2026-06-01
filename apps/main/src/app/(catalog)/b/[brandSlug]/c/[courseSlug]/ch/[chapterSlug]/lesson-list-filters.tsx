"use client";

import {
  CatalogGridSearchField,
  type CatalogGridSearchItem,
  matchesCatalogSearchQuery,
} from "@/components/catalog/catalog-grid";
import { CatalogGridContext } from "@/components/catalog/catalog-grid-context";
import {
  type LessonKindFilterSettings,
  getClearedHiddenLessonKinds,
  getHiddenLessonKindsForFilter,
  getNextHiddenLessonKinds,
} from "@/lib/lessons/lesson-kind-filters";
import { type LessonKind } from "@zoonk/db";
import { Button } from "@zoonk/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { toast } from "@zoonk/ui/components/sonner";
import { normalizeString } from "@zoonk/utils/string";
import { ListFilterIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useQueryState } from "nuqs";
import { type ReactNode, useState, useTransition } from "react";
import { updateHiddenLessonKindsAction } from "./lesson-list-actions";

type LessonKindOption = { kind: LessonKind; label: string };

type LessonTypeFilterItem = CatalogGridSearchItem & { kind: LessonKind };

/**
 * Lesson list filtering combines URL-backed text search with durable user
 * preferences, so this component owns the client state that has to update
 * immediately while the server action persists the same hidden-kind array.
 */
export function LessonListFilters({
  canPersistFilters,
  children,
  initialHiddenLessonKinds,
  items,
  lessonKindOptions,
  placeholder,
}: {
  canPersistFilters: boolean;
  children: ReactNode;
  initialHiddenLessonKinds: LessonKindFilterSettings["hiddenLessonKinds"];
  items: LessonTypeFilterItem[];
  lessonKindOptions: LessonKindOption[];
  placeholder: string;
}) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useQueryState("q", {
    defaultValue: "",
    shallow: true,
    throttleMs: 300,
  });

  const [hiddenLessonKinds, setHiddenLessonKinds] = useState(initialHiddenLessonKinds);

  const filterableLessonKinds = lessonKindOptions.map((option) => option.kind);

  const activeHiddenLessonKinds = getHiddenLessonKindsForFilter({
    filterableLessonKinds,
    hiddenLessonKinds,
  });

  const hiddenLessonKindSet = new Set(activeHiddenLessonKinds);

  const { filteredIds, isFilterActive } = getLessonFilterState({
    activeHiddenLessonKinds,
    hiddenLessonKindSet,
    items,
    search,
  });

  /**
   * The UI updates optimistically because hiding one kind is a lightweight
   * preference change; failed saves roll back so the visible list still matches
   * the server-owned setting.
   */
  function persistHiddenLessonKinds(nextHiddenLessonKinds: LessonKind[]) {
    const previousHiddenLessonKinds = hiddenLessonKinds;

    setHiddenLessonKinds(nextHiddenLessonKinds);

    if (!canPersistFilters) {
      return;
    }

    startTransition(async () => {
      const result = await updateHiddenLessonKindsAction({
        hiddenLessonKinds: nextHiddenLessonKinds,
      });

      if (result.status === "error") {
        setHiddenLessonKinds(previousHiddenLessonKinds);
        toast.error(t("Could not update lesson filters. Please try again."));
      }
    });
  }

  /**
   * The menu is phrased as visible lesson types, while the saved preference is
   * hidden lesson types. This adapter keeps that inversion out of the markup.
   */
  function updateLessonKindVisibility({
    isVisible,
    kind,
  }: {
    isVisible: boolean;
    kind: LessonKind;
  }) {
    persistHiddenLessonKinds(
      getNextHiddenLessonKinds({
        currentHiddenLessonKinds: hiddenLessonKinds,
        isHidden: !isVisible,
        kind,
      }),
    );
  }

  const hiddenCount = activeHiddenLessonKinds.length;

  return (
    <CatalogGridContext value={{ filteredIds, isFilterActive }}>
      <CatalogGridSearchField
        onSearchChange={(value) => setSearch(value || null)}
        placeholder={placeholder}
        search={search}
      >
        <LessonTypeFilterMenu
          hiddenLessonKindSet={hiddenLessonKindSet}
          hiddenCount={hiddenCount}
          isPending={isPending}
          lessonKindOptions={lessonKindOptions}
          onClear={() =>
            persistHiddenLessonKinds(
              getClearedHiddenLessonKinds({
                currentHiddenLessonKinds: hiddenLessonKinds,
                filterableLessonKinds,
              }),
            )
          }
          onVisibilityChange={updateLessonKindVisibility}
        />
      </CatalogGridSearchField>

      {children}
    </CatalogGridContext>
  );
}

/**
 * Search and type preferences both hide items, so a lesson only stays visible
 * when it matches the text query and its kind is not in the hidden set.
 */
function isLessonVisibleAfterFilters({
  hiddenLessonKindSet,
  item,
  query,
}: {
  hiddenLessonKindSet: Set<LessonKind>;
  item: LessonTypeFilterItem;
  query: string;
}) {
  if (hiddenLessonKindSet.has(item.kind)) {
    return false;
  }

  if (!query) {
    return true;
  }

  return matchesCatalogSearchQuery({ item, query });
}

/**
 * Search and hidden type filters share the same visibility result, so this
 * keeps the branching out of the component while the derived values stay plain
 * render-time calculations instead of being hidden in memo callbacks.
 */
function getLessonFilterState({
  activeHiddenLessonKinds,
  hiddenLessonKindSet,
  items,
  search,
}: {
  activeHiddenLessonKinds: LessonKind[];
  hiddenLessonKindSet: Set<LessonKind>;
  items: LessonTypeFilterItem[];
  search: string;
}) {
  const query = normalizeString(search);
  const isSearchActive = Boolean(query);
  const hasHiddenLessonKinds = activeHiddenLessonKinds.length > 0;

  if (!isSearchActive && !hasHiddenLessonKinds) {
    return { filteredIds: null, isFilterActive: false };
  }

  const matchingItems = items.filter((item) =>
    isLessonVisibleAfterFilters({ hiddenLessonKindSet, item, query }),
  );

  return {
    filteredIds: new Set(matchingItems.map((item) => String(item.id))),
    isFilterActive: true,
  };
}

/**
 * The dropdown keeps the control compact beside search while still showing the
 * full list of lesson kinds as regular menu checkbox items for keyboard users.
 */
function LessonTypeFilterMenu({
  hiddenLessonKindSet,
  hiddenCount,
  isPending,
  lessonKindOptions,
  onClear,
  onVisibilityChange,
}: {
  hiddenLessonKindSet: Set<LessonKind>;
  hiddenCount: number;
  isPending: boolean;
  lessonKindOptions: LessonKindOption[];
  onClear: () => void;
  onVisibilityChange: (params: { isVisible: boolean; kind: LessonKind }) => void;
}) {
  const t = useExtracted();

  if (lessonKindOptions.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label={t("Filter lesson types")}
            disabled={isPending}
            size="adaptive"
            variant={hiddenCount > 0 ? "secondary" : "outline"}
          />
        }
      >
        <ListFilterIcon aria-hidden="true" />
        <span className="hidden sm:inline">{t("Types")}</span>
        {hiddenCount > 0 && (
          <>
            <span
              aria-hidden="true"
              className="bg-primary ring-background absolute top-1 right-1 size-1.5 rounded-full ring-2 sm:hidden"
            />
            <span
              aria-hidden="true"
              className="bg-background/80 ml-0.5 hidden min-w-4 justify-center rounded-full px-1.5 text-xs text-current sm:inline-flex"
            >
              {hiddenCount}
            </span>
          </>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{t("Show lesson types")}</DropdownMenuLabel>
          {lessonKindOptions.map((option) => (
            <DropdownMenuCheckboxItem
              checked={!hiddenLessonKindSet.has(option.kind)}
              disabled={isPending}
              key={option.kind}
              onCheckedChange={(checked) =>
                onVisibilityChange({ isVisible: checked, kind: option.kind })
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>

        {hiddenCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={isPending} onClick={onClear} variant="destructive">
              <XIcon aria-hidden="true" />
              {t("Clear filter")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
