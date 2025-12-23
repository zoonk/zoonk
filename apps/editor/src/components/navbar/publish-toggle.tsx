"use client";

import { Label } from "@zoonk/ui/components/label";
import { toast } from "@zoonk/ui/components/sonner";
import { Switch } from "@zoonk/ui/components/switch";
import { useExtracted } from "next-intl";
import { useOptimistic, useTransition } from "react";

type PublishToggleProps = {
  courseId: number;
  isPublished: boolean;
  onToggle: (isPublished: boolean) => Promise<{ error: string | null }>;
};

export function PublishToggle({
  courseId,
  isPublished,
  onToggle,
}: PublishToggleProps) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();
  const [optimisticPublished, setOptimisticPublished] =
    useOptimistic(isPublished);

  function handleToggle(checked: boolean) {
    startTransition(async () => {
      setOptimisticPublished(checked);

      const result = await onToggle(checked);

      if (result.error) {
        setOptimisticPublished(!checked);
        toast.error(result.error);
      }
    });
  }

  return (
    <Label className="cursor-pointer select-none gap-2">
      <Switch
        checked={optimisticPublished}
        disabled={isPending}
        name={`publish-course-${courseId}`}
        onCheckedChange={handleToggle}
        size="sm"
      />

      <span className="text-muted-foreground text-xs sm:text-sm">
        {optimisticPublished ? t("Published") : t("Draft")}
      </span>
    </Label>
  );
}
