"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@zoonk/ui/lib/utils";
import { TAB_CLASS, TAB_LIST_CLASS } from "./tabs";

/**
 * Tabs that are links: a section's pages, a record's parts, a list's views. The row reaches 10px
 * past its column on both sides, so the first label starts on the column's edge and the current
 * tab's fill hangs past it like a highlighted row.
 */
function TabLinks({
  children,
  className,
  label,
  ...props
}: Omit<React.ComponentProps<"nav">, "aria-label"> & { label: string }) {
  return (
    <nav aria-label={label} className={cn("min-w-0", className)} data-slot="tab-links" {...props}>
      <ul className={cn(TAB_LIST_CLASS, "-mx-2.5 -my-2 scrollbar-none overflow-x-auto py-2")}>
        {children}
      </ul>
    </nav>
  );
}

/** One tab: pass the app's own link as `render`. A count after the label goes in `TabLinkCount`. */
function TabLink({
  className,
  current,
  render,
  ...props
}: useRender.ComponentProps<"a"> & { current: boolean }) {
  const link = useRender({
    defaultTagName: "a",
    props: mergeProps<"a">(
      { "aria-current": current ? "page" : undefined, className: cn(TAB_CLASS, className) },
      props,
    ),
    render,
    state: { slot: "tab-link" },
  });

  return <li>{link}</li>;
}

function TabLinkCount({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn("font-mono text-xs tabular-nums", className)}
      data-slot="tab-link-count"
      {...props}
    />
  );
}

export { TabLink, TabLinkCount, TabLinks };
