"use client";

import { useCategoryLabels } from "@/lib/use-category-labels";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { EditableLabel } from "@zoonk/ui/components/editable-text";
import { Input } from "@zoonk/ui/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@zoonk/ui/components/popover";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toast } from "@zoonk/ui/components/sonner";
import { PlusIcon, TagsIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { CategoryOption } from "./category-option";

export function CategoryEditorSkeleton() {
  return (
    <div className="flex flex-col gap-1 px-4">
      <Skeleton className="h-3 w-16" />
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-5 w-12 rounded-4xl" />
        <Skeleton className="h-5 w-16 rounded-4xl" />
        <Skeleton className="h-5 w-14 rounded-4xl" />
      </div>
    </div>
  );
}

export function CategoryEditor({
  categories,
  onAdd,
  onRemove,
}: {
  categories: string[];
  onAdd: (category: string) => Promise<{ error: string | null }>;
  onRemove: (category: string) => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const { labels: categoryLabels, sortedCategories, getLabel } = useCategoryLabels();

  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");

  const [optimisticCategories, updateOptimistic] = useOptimistic(
    categories,
    (state, action: { type: "add"; category: string } | { type: "remove"; category: string }) => {
      if (action.type === "add") {
        return [...state, action.category];
      }

      return state.filter((item) => item !== action.category);
    },
  );

  const sortedOptimisticCategories = [...optimisticCategories].toSorted((a, b) => {
    const labelA = getLabel(a) ?? a;
    const labelB = getLabel(b) ?? b;
    return labelA.localeCompare(labelB);
  });

  const filteredCategories = useMemo(() => {
    if (!search.trim()) {
      return sortedCategories;
    }

    const searchLower = search.toLowerCase();

    return sortedCategories.filter((category) =>
      categoryLabels[category].toLowerCase().includes(searchLower),
    );
  }, [sortedCategories, categoryLabels, search]);

  function handleToggle(category: string, isSelected: boolean) {
    startTransition(async () => {
      if (isSelected) {
        updateOptimistic({ category, type: "remove" });

        const { error } = await onRemove(category);

        if (error) {
          toast.error(error);
        }
      } else {
        updateOptimistic({ category, type: "add" });

        const { error } = await onAdd(category);

        if (error) {
          toast.error(error);
        }
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <EditableLabel icon={TagsIcon}>{t("Categories")}</EditableLabel>

      <div className="flex flex-wrap items-center gap-2">
        {sortedOptimisticCategories.map((category) => {
          const label = getLabel(category);

          if (!label) {
            return null;
          }

          return (
            <Badge key={category} variant="outline">
              {label}
            </Badge>
          );
        })}

        <Popover>
          <PopoverTrigger
            render={
              <Button
                aria-label={t("Add category")}
                disabled={isPending}
                size="icon-xs"
                variant="outline"
              />
            }
          >
            <PlusIcon />
          </PopoverTrigger>

          <PopoverContent align="start" aria-label={t("Category options")} className="w-56 p-2">
            <Input
              className="mb-2"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`${t("Search")}…`}
              type="search"
              value={search}
            />

            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto overscroll-contain">
              {filteredCategories.map((category) => (
                <CategoryOption
                  category={category}
                  isSelected={optimisticCategories.includes(category)}
                  key={category}
                  label={categoryLabels[category]}
                  onToggle={handleToggle}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
