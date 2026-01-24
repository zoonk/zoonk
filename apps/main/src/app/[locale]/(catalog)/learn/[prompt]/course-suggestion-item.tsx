import { Link } from "@/i18n/navigation";
import { buttonVariants } from "@zoonk/ui/components/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemSeparator,
  ItemTitle,
} from "@zoonk/ui/components/item";
import { SparklesIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { Fragment } from "react/jsx-runtime";

type CourseSuggestionItemProps = {
  course: { id: number; title: string; description: string };
  isLast: boolean;
};

export async function CourseSuggestionItem({ course, isLast }: CourseSuggestionItemProps) {
  const t = await getExtracted();

  return (
    <Fragment>
      <Item className="px-0 py-2">
        <ItemContent className="gap-0.5">
          <ItemTitle>{course.title}</ItemTitle>
          <ItemDescription>{course.description}</ItemDescription>
        </ItemContent>

        <ItemActions>
          <Link
            className={buttonVariants({
              className: "gap-1.5",
              size: "sm",
              variant: "outline",
            })}
            href={`/generate/cs/${course.id}`}
            prefetch={false}
          >
            <SparklesIcon aria-hidden="true" className="size-4" />
            {t("Generate")}
          </Link>
        </ItemActions>
      </Item>

      {!isLast && <ItemSeparator />}
    </Fragment>
  );
}
