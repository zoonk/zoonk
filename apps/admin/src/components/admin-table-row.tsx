import { TableRow } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { type Route } from "next";
import Link from "next/link";
import { type ComponentProps } from "react";

/**
 * Every row of an Admin table: its cells share the first line's baseline, so a mono number sits on
 * the same line as the words beside it. One that holds a row link opens its record from anywhere on it.
 * A transform contains the stretched link on Safari: https://bugs.webkit.org/show_bug.cgi?id=240961
 */
export function AdminTableRow({ className, ...props }: ComponentProps<"tr">) {
  return (
    <TableRow
      className={cn(
        "has-data-[slot=table-row-link]:hover:bg-muted/50 has-data-[slot=table-row-link]:transform-gpu has-data-[slot=table-row-link]:cursor-pointer [&:has(img)>td]:align-middle [&>td]:py-3 [&>td]:align-baseline",
        "has-data-[slot=table-row-link]:[&_a:not([data-slot=table-row-link])]:hit-area has-data-[slot=table-row-link]:[&_:is(a,button,form,input,select,textarea,summary,audio,video):not([data-slot=table-row-link])]:relative has-data-[slot=table-row-link]:[&_:is(a,button,form,input,select,textarea,summary,audio,video):not([data-slot=table-row-link])]:z-10",
        className,
      )}
      {...props}
    />
  );
}

/** The link that opens a row's record: it stretches over the whole row. */
const TABLE_ROW_LINK_CLASS =
  "focus-visible:after:ring-ring after:absolute after:inset-0 after:z-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset";

export function AdminTableRowLink<Href extends string>({
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, "href"> & { href: Route<Href> | URL }) {
  return (
    <Link className={cn(TABLE_ROW_LINK_CLASS, className)} data-slot="table-row-link" {...props} />
  );
}
