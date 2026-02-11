"use client";

import { ClientLink } from "@/i18n/client-link";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { API_URL } from "@zoonk/utils/constants";
import { getString, isJsonObject } from "@zoonk/utils/json";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import useSWR from "swr";

function buildQueryString(props: { chapterId?: number; courseId?: number; lessonId?: number }) {
  if (props.courseId) {
    return `courseId=${props.courseId}`;
  }

  if (props.chapterId) {
    return `chapterId=${props.chapterId}`;
  }

  if (props.lessonId) {
    return `lessonId=${props.lessonId}`;
  }

  return "";
}

async function fetchNextActivity(url: string): Promise<{
  activityPosition: number;
  brandSlug: string;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
} | null> {
  const res = await fetch(url, { credentials: "include" });
  const json: unknown = await res.json();

  if (!isJsonObject(json)) {
    return null;
  }

  const brandSlug = getString(json, "brandSlug");

  if (!brandSlug) {
    return null;
  }

  return {
    activityPosition: Number(json.activityPosition),
    brandSlug,
    chapterSlug: getString(json, "chapterSlug") ?? "",
    completed: json.completed === true,
    courseSlug: getString(json, "courseSlug") ?? "",
    hasStarted: json.hasStarted === true,
    lessonSlug: getString(json, "lessonSlug") ?? "",
  };
}

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
  const queryString = buildQueryString({ chapterId, courseId, lessonId });

  const { data, isLoading } = useSWR(
    `${API_URL}/v1/progress/next-activity?${queryString}`,
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
      <ClientLink className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")} href={fallbackHref}>
        {t("Start")}
        <ChevronRightIcon aria-hidden="true" />
      </ClientLink>
    );
  }

  const href = `/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}/a/${data.activityPosition}`;

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
    <ClientLink className={cn(buttonVariants(), "min-w-0 flex-1 gap-2")} href={href}>
      {getLabel()}
      <ChevronRightIcon aria-hidden="true" />
    </ClientLink>
  );
}
