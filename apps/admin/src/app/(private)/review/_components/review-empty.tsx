import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@zoonk/ui/components/empty";

export function ReviewEmpty() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>All caught up</EmptyTitle>
        <EmptyDescription>There are no items left to review in this category.</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
