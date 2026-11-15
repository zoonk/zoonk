import { HorizontalScroll } from "@zoonk/ui/components/horizontal-scroll";
import { Table } from "@zoonk/ui/components/table";

export function ScrollTable(props: React.ComponentProps<typeof Table>) {
  return (
    <HorizontalScroll
      box={{ label: "Table" }}
      className="min-w-0 **:data-[slot=table-container]:overflow-visible"
      labels={{ left: "Scroll left", right: "Scroll right" }}
    >
      <Table {...props} />
    </HorizontalScroll>
  );
}
