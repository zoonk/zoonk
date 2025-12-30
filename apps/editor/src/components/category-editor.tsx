"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { Checkbox } from "@zoonk/ui/components/checkbox";
import { EditableLabel } from "@zoonk/ui/components/editable-text";
import { Label } from "@zoonk/ui/components/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@zoonk/ui/components/popover";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { PlusIcon, TagsIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useOptimistic, useTransition } from "react";
import { useCategoryLabels } from "@/hooks/use-category-labels";

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

type CategoryEditorProps = {
  categories: string[];
  onAdd: (category: string) => Promise<{ error: string | null }>;
  onRemove: (category: string) => Promise<{ error: string | null }>;
};

type OptimisticAction =
  | { type: "add"; category: string }
  | { type: "remove"; category: string };

export function CategoryEditor({
  categories,
  onAdd,
  onRemove,
}: CategoryEditorProps) {
  const t = useExtracted();
  const { labels: categoryLabels, getLabel } = useCategoryLabels();
  const [isPending, startTransition] = useTransition();

  const [optimisticCategories, updateOptimistic] = useOptimistic(
    categories,
    (state, action: OptimisticAction) => {
      if (action.type === "add") {
        return [...state, action.category].sort();
      }

      return state.filter((c) => c !== action.category);
    },
  );

  function handleToggle(category: string, isSelected: boolean) {
    startTransition(async () => {
      if (isSelected) {
        updateOptimistic({ category, type: "remove" });
        await onRemove(category);
      } else {
        updateOptimistic({ category, type: "add" });
        await onAdd(category);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <EditableLabel icon={TagsIcon}>{t("Categories")}</EditableLabel>

      <div className="flex flex-wrap items-center gap-2">
        {optimisticCategories.map((category) => {
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

          <PopoverContent align="start" className="w-56 p-2">
            <div className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {COURSE_CATEGORIES.map((category) => {
                const isSelected = optimisticCategories.includes(category);

                return (
                  <Label
                    className="cursor-pointer rounded-lg px-2 py-1.5 hover:bg-muted"
                    key={category}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => handleToggle(category, isSelected)}
                    />
                    {categoryLabels[category]}
                  </Label>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
