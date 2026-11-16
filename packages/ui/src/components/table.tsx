"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { HorizontalScroll } from "./horizontal-scroll";
import type * as React from "react";

/** Wider than its room, it scrolls with the scroll sign; `scrollLabels` name the box and its buttons. */
function Table({
  className,
  scrollLabels,
  ...props
}: React.ComponentProps<"table"> & { scrollLabels: { box: string; left: string; right: string } }) {
  return (
    <HorizontalScroll
      box={{ label: scrollLabels.box }}
      className="w-full min-w-0"
      labels={scrollLabels}
    >
      <table
        className={cn("w-full caption-bottom text-sm tabular-nums", className)}
        data-slot="table"
        {...props}
      />
    </HorizontalScroll>
  );
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return <thead className={cn("[&_tr]:border-b", className)} data-slot="table-header" {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      className={cn("[&_tr:last-child]:border-0", className)}
      data-slot="table-body"
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      className={cn("data-[state=selected]:bg-muted border-b transition-colors", className)}
      data-slot="table-row"
      {...props}
    />
  );
}

/** A column of numbers that are compared: Geist Mono, digit under digit, ending on one edge (craft T4). */
const NUMERIC_CLASS = "text-right font-mono tabular-nums";

function TableHead({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      className={cn(
        "text-muted-foreground h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap first:pl-0 last:pr-0 has-[[role=checkbox]]:pr-0",
        numeric && "text-right",
        className,
      )}
      data-slot="table-head"
      {...props}
    />
  );
}

function TableCell({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-3 py-2 align-middle whitespace-nowrap first:pl-0 last:pr-0 has-[[role=checkbox]]:pr-0",
        numeric && cn(NUMERIC_CLASS, "text-compact leading-5"),
        className,
      )}
      data-slot="table-cell"
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
