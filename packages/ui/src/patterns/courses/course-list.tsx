import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  type ItemGroupProps,
  ItemMedia,
  type ItemProps,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";

export type CourseListItem = {
  id: number;
  description: string | null;
  imageUrl: string | null;
  slug: string;
  title: string;
};

type CourseListItemProps = {
  course: CourseListItem;
  image?: React.ReactNode;
  linkComponent: ItemProps["render"];
};

export function CourseListItemView({ course, image, linkComponent }: CourseListItemProps) {
  return (
    <Item render={linkComponent}>
      {image ? (
        <ItemMedia className="size-16" variant="image">
          {image}
        </ItemMedia>
      ) : (
        <ItemMedia className="size-16" variant="icon">
          <NotebookPenIcon className="text-muted-foreground/80 size-6" />
        </ItemMedia>
      )}

      <ItemContent>
        <ItemTitle>{course.title}</ItemTitle>
        <ItemDescription>{course.description}</ItemDescription>
      </ItemContent>

      <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4" />
    </Item>
  );
}

export function CourseListGroup({ className, layout = "grid", ...props }: ItemGroupProps) {
  return (
    <ItemGroup
      className={cn({ "-mt-4": layout === "grid" }, className)}
      layout={layout}
      {...props}
    />
  );
}

const DEFAULT_LIST_COUNT = 5;

export function CourseListSkeleton({
  count,
  layout = "list",
}: {
  count?: number;
  layout?: ItemGroupProps["layout"];
}) {
  const defaultCount = layout === "list" ? DEFAULT_LIST_COUNT : 12;

  return (
    <ItemGroup layout={layout}>
      {/* eslint-disable react/no-array-index-key -- Static skeleton placeholders */}
      {Array.from({ length: count ?? defaultCount }).map((_, index) => (
        <Item key={index}>
          <ItemMedia className="size-16 translate-y-0.5 self-start" variant="image">
            <Skeleton className="size-full" />
          </ItemMedia>

          <ItemContent className="pt-1">
            <Skeleton className="h-4 w-full max-w-48" />
            <Skeleton className="h-4 w-full max-w-72" />
          </ItemContent>
        </Item>
      ))}
    </ItemGroup>
  );
}
