"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@zoonk/ui/components/collapsible";
import { Input } from "@zoonk/ui/components/input";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { toSlug } from "@zoonk/utils/string";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import {
  startTransition,
  useActionState,
  useMemo,
  useOptimistic,
  useState,
} from "react";

const MAX_VISIBLE_ITEMS = 10;

export function AlternativeTitlesEditor({
  titles,
  onAdd,
  onDelete,
}: {
  titles: string[];
  onAdd: (title: string) => Promise<{ error: string | null }>;
  onDelete: (slug: string) => Promise<{ error: string | null }>;
}) {
  const t = useExtracted();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [optimisticTitles, updateOptimisticTitles] = useOptimistic(titles);

  const filteredTitles = useMemo(() => {
    if (!search.trim()) {
      return optimisticTitles.slice(0, MAX_VISIBLE_ITEMS);
    }

    const searchLower = search.toLowerCase();

    return optimisticTitles.filter((title) =>
      title.toLowerCase().includes(searchLower),
    );
  }, [optimisticTitles, search]);

  const hasMore = !search.trim() && optimisticTitles.length > MAX_VISIBLE_ITEMS;
  const hiddenCount = optimisticTitles.length - MAX_VISIBLE_ITEMS;

  async function handleAdd(
    _state: { error: string | null },
    formData: FormData,
  ) {
    const title = formData.get("title") as string;

    if (!title?.trim()) {
      return { error: null };
    }

    const slug = toSlug(title);

    startTransition(() => {
      updateOptimisticTitles((prev) =>
        prev.includes(slug) ? prev : [...prev, slug].sort(),
      );
    });

    const result = await onAdd(title);

    return result;
  }

  async function handleDelete(slug: string) {
    startTransition(() => {
      updateOptimisticTitles((prev) => prev.filter((item) => item !== slug));
    });

    await onDelete(slug);
  }

  const [addState, addAction, isAdding] = useActionState(handleAdd, {
    error: null,
  });

  return (
    <Collapsible onOpenChange={setIsOpen} open={isOpen}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 py-2 text-muted-foreground text-sm hover:text-foreground">
        {isOpen ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
        <span>{t("Alternative titles")}</span>
        {optimisticTitles.length > 0 && (
          <span className="text-muted-foreground/60">
            {t("({count})", { count: String(optimisticTitles.length) })}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent className="space-y-3 pb-4">
        <form action={addAction} className="flex gap-2">
          <Input
            className="h-8 text-sm"
            disabled={isAdding}
            key={isAdding ? "adding" : "idle"}
            name="title"
            placeholder={t("Add alternative title…")}
          />
          <Button disabled={isAdding} size="sm" type="submit">
            {t("Add")}
          </Button>
        </form>

        {addState.error && (
          <p className="text-destructive text-sm">{addState.error}</p>
        )}

        {optimisticTitles.length > 0 && (
          <>
            <div className="relative">
              <SearchIcon className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="h-8 pl-9 text-sm"
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("Search titles…")}
                value={search}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              {filteredTitles.map((slug) => (
                <Badge
                  className="gap-1 pr-1 font-normal"
                  key={slug}
                  variant="outline"
                >
                  {slug}
                  <button
                    aria-label={t("Remove {title}", { title: slug })}
                    className="rounded-full p-0.5 hover:bg-muted"
                    onClick={() => handleDelete(slug)}
                    type="button"
                  >
                    <XIcon className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>

            {hasMore && (
              <p className="text-muted-foreground text-xs">
                {t("and {count} more", { count: String(hiddenCount) })}
              </p>
            )}

            {search && filteredTitles.length === 0 && (
              <p className="text-muted-foreground text-sm">
                {t("No titles match your search")}
              </p>
            )}
          </>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function AlternativeTitlesSkeleton() {
  return (
    <div className="flex items-center gap-2 py-2">
      <Skeleton className="size-4" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
