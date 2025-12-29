import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  type ItemProps,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { ChevronRightIcon, NotebookPenIcon } from "lucide-react";

export type CourseListItem = {
  id: number;
  description: string;
  imageUrl: string | null;
  slug: string;
  title: string;
};

type CourseListItemProps = {
  course: CourseListItem;
  image?: React.ReactNode;
  linkComponent: ItemProps["render"];
};

export function CourseListItemView({
  course,
  image,
  linkComponent,
}: CourseListItemProps) {
  return (
    <Item render={linkComponent}>
      {image ? (
        <ItemMedia className="size-16" variant="image">
          {image}
        </ItemMedia>
      ) : (
        <ItemMedia className="size-16" variant="icon">
          <NotebookPenIcon className="size-6 text-muted-foreground/80" />
        </ItemMedia>
      )}

      <ItemContent>
        <ItemTitle>{course.title}</ItemTitle>
        <ItemDescription>{course.description}</ItemDescription>
      </ItemContent>

      <ChevronRightIcon
        aria-hidden="true"
        className="size-4 text-muted-foreground"
      />
    </Item>
  );
}

export function CourseListGroup(props: React.ComponentProps<typeof ItemGroup>) {
  return <ItemGroup {...props} />;
}

export function CourseListSkeleton({ count = 10 }: { count?: number }) {
  return (
    <ItemGroup>
      {Array.from({ length: count }).map((_, index) => (
        <Item key={index}>
          <ItemMedia variant="image">
            <Skeleton className="size-16" />
          </ItemMedia>

          <ItemContent>
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-72" />
          </ItemContent>

          <Skeleton className="h-5 w-10 rounded-full" />

          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 text-muted-foreground"
          />
        </Item>
      ))}
    </ItemGroup>
  );
}
