"use client";

import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { LIST_GROUP_CLASS } from "../_components/list-group";
import { DoneMark } from "../_components/status-mark";

export function ChecklistRows({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn(LIST_GROUP_CLASS, "w-full text-left", className)}
      data-slot="checklist-rows"
      {...props}
    />
  );
}

export function ChecklistRow({
  children,
  className,
  description,
  done,
  lang,
}: {
  children: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
  done: boolean;
  lang?: string;
}) {
  const t = useExtracted();

  return (
    <li
      className={cn("flex items-start gap-3 py-2.5 text-sm leading-snug", className)}
      data-slot="checklist-row"
    >
      <LineMarker aria-hidden="true">
        <span className="flex size-4 items-center justify-center">
          {done ? (
            <DoneMark />
          ) : (
            <span className="border-foreground/30 size-2 rounded-full border-[1.5px]" />
          )}
        </span>
      </LineMarker>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="font-medium text-pretty">
          <span lang={lang}>{children}</span>
          <span className="sr-only">{done ? t(", done") : t(", not yet")}</span>
        </span>
        {description && (
          <span className="text-muted-foreground text-xs leading-snug text-pretty">
            {description}
          </span>
        )}
      </span>
    </li>
  );
}
