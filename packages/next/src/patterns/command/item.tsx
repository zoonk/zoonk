"use client";

import { CommandItem } from "@zoonk/ui/components/command";
import { useCommandPaletteSelect } from "./item-context";

export type CommandPaletteItemProps = React.ComponentProps<
  typeof CommandItem
> & {
  /**
   * The URL value for this item. Used for selection handling.
   */
  href: string;
};

/**
 * A command palette item that integrates with the command palette's selection system.
 * When selected, it closes the dialog and triggers the navigation callback.
 *
 * @example
 * ```tsx
 * <CommandPaletteItem href="/courses/123">
 *   <CourseImage />
 *   <span>Course Title</span>
 * </CommandPaletteItem>
 * ```
 */
export function CommandPaletteItem({
  children,
  href,
  ...props
}: CommandPaletteItemProps) {
  const onSelect = useCommandPaletteSelect();

  return (
    <CommandItem {...props} onSelect={() => onSelect(href)} value={href}>
      {children}
    </CommandItem>
  );
}
