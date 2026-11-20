import { cn } from "@zoonk/ui/lib/utils";

/**
 * A settings tab's list and its detail from `xl`, for whoever has a session: the rows at the start
 * in the room the detail doesn't need, the detail at the column's measure on the end edge
 * (`SIDE_DETAIL_PANE_CLASS`), its Save in the page's bar. The notebook's proportions.
 */
export const LIST_DETAIL_GRID_CLASS =
  "xl:in-data-signed-in:grid xl:in-data-signed-in:flex-1 xl:in-data-signed-in:grid-cols-[minmax(20rem,1fr)_minmax(0,calc(var(--container-column)+var(--page-gutter)+1px))] xl:in-data-signed-in:gap-x-8";

export const SIDE_DETAIL_PANE_CLASS =
  "xl:in-data-signed-in:border-border xl:in-data-signed-in:flex xl:in-data-signed-in:min-w-0 xl:in-data-signed-in:flex-col xl:in-data-signed-in:border-s xl:in-data-signed-in:ps-(--page-gutter)";

/** In the aside a row is a block: its label on the aside's title line, its control under it. */
const ASIDE_ROW_CLASS = cn(
  "xl:in-data-signed-in:**:data-[slot=list-row]:flex-col xl:in-data-signed-in:**:data-[slot=list-row]:items-start xl:in-data-signed-in:**:data-[slot=list-row]:gap-2",
  "xl:in-data-signed-in:[&_[data-slot=list-row]>*]:min-h-6 xl:in-data-signed-in:[&_[data-slot=list-row]>*]:py-0",
  "xl:in-data-signed-in:**:data-[slot=list-row-title]:font-semibold",
);

/**
 * What a tab says beside its rows: from `xl`, for whoever has a session, it is drawn in the
 * section's aside, which shows for it (`[data-slot=page-aside-note]`), so the tab's rows end where
 * the aside starts. Anywhere else it stays where it stands, under the rows.
 */
export function PageAsideNote({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "xl:in-data-signed-in:bg-background xl:in-data-signed-in:px-frame xl:in-data-signed-in:fixed xl:in-data-signed-in:inset-y-0 xl:in-data-signed-in:right-0 xl:in-data-signed-in:z-40 xl:in-data-signed-in:w-[calc(20rem-1px)] xl:in-data-signed-in:overflow-y-auto xl:in-data-signed-in:pt-3",
        ASIDE_ROW_CLASS,
        className,
      )}
      data-slot="page-aside-note"
      {...props}
    />
  );
}
