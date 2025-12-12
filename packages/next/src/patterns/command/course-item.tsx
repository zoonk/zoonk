"use client";

import { Badge } from "@zoonk/ui/components/badge";
import { CommandItem } from "@zoonk/ui/components/command";
import Image from "next/image";
import { useCommandPaletteSelect } from "./item-context";

export type CommandPaletteCourseItemProps = {
  imageUrl: string;
  language: string;
  title: string;
  url: string;
};

/**
 * A client component for rendering a course item in the command palette.
 * Uses the CommandPaletteItemContext to handle selection and navigation.
 */
export function CommandPaletteCourseItem({
  imageUrl,
  language,
  title,
  url,
}: CommandPaletteCourseItemProps) {
  const onSelect = useCommandPaletteSelect();

  return (
    <CommandItem onSelect={() => onSelect(url)} value={url}>
      <Image
        alt={title}
        className="size-8 rounded object-cover"
        height={32}
        src={imageUrl}
        width={32}
      />
      <span className="flex-1">{title}</span>
      <Badge className="uppercase" variant="outline">
        {language}
      </Badge>
    </CommandItem>
  );
}
