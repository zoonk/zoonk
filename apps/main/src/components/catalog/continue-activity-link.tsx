import { type ActivityScope } from "@zoonk/core/activities/last-completed";
import { getNextActivity } from "@zoonk/core/progress/next-activity";
import { buttonVariants } from "@zoonk/ui/components/button";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { type Route } from "next";
import { getExtracted } from "next-intl/server";
import Link from "next/link";

function getScope(props: {
  chapterId?: number;
  courseId?: number;
  lessonId?: number;
}): ActivityScope {
  if (props.courseId) {
    return { courseId: props.courseId };
  }

  if (props.chapterId) {
    return { chapterId: props.chapterId };
  }

  return { lessonId: props.lessonId ?? 0 };
}

export async function ContinueActivityLink<Href extends string>({
  chapterId,
  courseId,
  fallbackHref,
  lessonId,
}: {
  chapterId?: number;
  courseId?: number;
  fallbackHref: Route<Href>;
  lessonId?: number;
}) {
  const t = await getExtracted();
  const scope = getScope({ chapterId, courseId, lessonId });
  const data = await getNextActivity({ scope });

  if (!data) {
    return (
      <Link className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")} href={fallbackHref}>
        {t("Start")}
        <ChevronRightIcon aria-hidden="true" />
      </Link>
    );
  }

  const getLabel = () => {
    if (data.completed) {
      return t("Review");
    }

    if (data.hasStarted) {
      return t("Continue");
    }

    return t("Start");
  };

  return (
    <Link
      className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")}
      href={`/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}/a/${data.activityPosition}`}
    >
      {getLabel()}
      <ChevronRightIcon aria-hidden="true" />
    </Link>
  );
}

export function ContinueActivityLinkSkeleton() {
  return <Skeleton className="h-9 min-w-0 flex-1 rounded-md" />;
}
