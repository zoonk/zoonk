"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { BookmarkIcon } from "lucide-react";
import { useExtracted } from "next-intl";

export type MindMapSave = { onToggle: () => void; saved: boolean };

export function SavedBookmarkIcon({ className, saved }: { className?: string; saved: boolean }) {
  return <BookmarkIcon aria-hidden="true" className={cn(saved && "fill-current", className)} />;
}

/** The label says the state, so it reads the same to everyone: "Save" until it's "Saved". */
export function MindMapSaveButton({
  children,
  className,
  labelled = true,
  onToggle,
  saved,
  size = "bar",
  variant = "outline",
  ...props
}: MindMapSave &
  Pick<React.ComponentProps<typeof Button>, "aria-keyshortcuts" | "size" | "variant"> & {
    /** A keycap, after the label. */
    children?: React.ReactNode;
    className?: string;
    /** False draws the bookmark alone, where there's no room for the word. */
    labelled?: boolean;
  }) {
  const t = useExtracted();

  return (
    <Button
      aria-pressed={saved}
      className={className}
      data-slot="mind-map-save"
      icon={<SavedBookmarkIcon saved={saved} />}
      onClick={onToggle}
      size={size}
      variant={variant}
      {...props}
    >
      <span className={cn(!labelled && "sr-only")}>{saved ? t("Saved") : t("Save")}</span>
      {children}
    </Button>
  );
}
