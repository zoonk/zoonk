import { Button } from "@zoonk/ui/components/button";
import { TableHead } from "@zoonk/ui/components/table";
import { Columns3Icon } from "lucide-react";

export type SortDirection = "asc" | "desc";

export function SortHead({
  children,
  direction,
  isActive,
  onSort,
}: React.PropsWithChildren<{ direction: SortDirection; isActive: boolean; onSort: () => void }>) {
  const arrow = direction === "asc" ? "↑" : "↓";

  return (
    <TableHead aria-sort={isActive ? `${direction}ending` : undefined}>
      <button className="min-h-11 min-w-11 cursor-pointer text-left" onClick={onSort} type="button">
        {children} {isActive && arrow}
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
