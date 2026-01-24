"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type AlternativeTitleBadgeProps = {
  onDelete: (slug: string) => void;
  slug: string;
};

export function AlternativeTitleBadge({ onDelete, slug }: AlternativeTitleBadgeProps) {
  const t = useExtracted();

  return (
    <Badge className="gap-1 pr-1 font-normal" variant="outline">
      {slug}
      <button
        aria-label={t("Remove {title}", { title: slug })}
        className="hover:bg-muted rounded-full p-0.5"
        onClick={() => onDelete(slug)}
        type="button"
      >
        <XIcon className="size-3" />
      </button>
    </Badge>
  );
}
