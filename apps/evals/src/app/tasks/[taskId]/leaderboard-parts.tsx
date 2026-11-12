import { Button } from "@zoonk/ui/components/button";
import { TableCell, TableHead } from "@zoonk/ui/components/table";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, ArrowUpIcon, Columns3Icon } from "lucide-react";

export type SortDirection = "asc" | "desc";

export function NumberHead({ className, ...props }: React.ComponentProps<typeof TableHead>) {
  return <TableHead className={cn("text-right", className)} {...props} />;
}

export function NumberCell({ className, ...props }: React.ComponentProps<typeof TableCell>) {
  return <TableCell className={cn("text-right", className)} {...props} />;
}

/** A number column keeps its label on the numbers' edge, so its arrow goes before the label. */
export function SortHead({
  children,
  direction,
  isActive,
  isNumber,
  onSort,
}: React.PropsWithChildren<{
  direction: SortDirection;
  isActive: boolean;
  isNumber?: boolean;
  onSort: () => void;
}>) {
  const Arrow = direction === "asc" ? ArrowUpIcon : ArrowDownIcon;
  const arrow = isActive && <Arrow aria-hidden="true" className="size-3.5" />;

  return (
    <TableHead
      aria-sort={isActive ? `${direction}ending` : undefined}
      className={cn(isNumber && "text-right")}
    >
      <button
        className={cn(
          "hit-area relative flex w-full cursor-pointer items-center gap-1",
          isNumber && "justify-end",
        )}
        onClick={onSort}
        type="button"
      >
        {isNumber && arrow}
        {children}
        {!isNumber && arrow}
      </button>
    </TableHead>
  );
}

export function MoreColumnsButton({ isOpen, onToggle }: { isOpen: boolean; onToggle: () => void }) {
  return (
    <Button
      aria-pressed={isOpen}
      icon={<Columns3Icon />}
      onClick={onToggle}
      size="sm"
      variant="outline"
    >
      {isOpen ? "Fewer columns" : "More columns"}
    </Button>
  );
}
