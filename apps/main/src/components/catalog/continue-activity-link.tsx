"use client";

import { buildNextActivityKey, fetchNextActivity } from "@/lib/progress-fetchers";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import Link from "next/link";
import useSWR from "swr";

export function ContinueActivityLink({
  chapterId,
  courseId,
  fallbackHref,
  lessonId,
}: {
  chapterId?: number;
  courseId?: number;
  fallbackHref: string;
  lessonId?: number;
}) {
  const t = useExtracted();

  const { data, isLoading } = useSWR(
    buildNextActivityKey({ chapterId, courseId, lessonId }),
    fetchNextActivity,
  );

  if (isLoading) {
    return (
      <Button className="min-w-0 flex-1" disabled>
        {t("Start")}
      </Button>
    );
  }

  if (!data) {
    return (
      <Link className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")} href={fallbackHref as never}>
        {t("Start")}
        <ChevronRightIcon aria-hidden="true" />
      </Link>
    );
  }

  const href =
    `/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}/a/${data.activityPosition}` as const;

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
    <Link className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")} href={href}>
      {getLabel()}
      <ChevronRightIcon aria-hidden="true" />
    </Link>
  );
}
