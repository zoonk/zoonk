"use client";

import { Label } from "@zoonk/ui/components/label";
import { toast } from "@zoonk/ui/components/sonner";
import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useOptimistic, useTransition } from "react";

type PublishToggleProps = {
  isPublished: boolean;
  onToggle?: (isPublished: boolean) => Promise<{ error: string | null }>;
};

export function PublishToggle({ isPublished, onToggle }: PublishToggleProps) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [optimisticPublished, setOptimisticPublished] =
    useOptimistic(isPublished);

  function handleToggle(checked: boolean) {
    if (!onToggle) {
      return;
    }

    startTransition(async () => {
      setOptimisticPublished(checked);

      const result = await onToggle(checked);

      if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Label className="cursor-pointer select-none gap-2">
      <span className="text-muted-foreground text-xs sm:text-sm">
        {optimisticPublished ? t("Published") : t("Draft")}
      </span>

      <Switch
        checked={optimisticPublished}
        disabled={isPending || !onToggle}
        onCheckedChange={handleToggle}
        size="sm"
      />
    </Label>
  );
}
