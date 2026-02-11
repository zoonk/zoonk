"use client";

import { ClientLink } from "@/i18n/client-link";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { API_URL } from "@zoonk/utils/constants";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";

type NextActivityData = {
  activityPosition: number;
  brandSlug: string;
  chapterSlug: string;
  completed: boolean;
  courseSlug: string;
  hasStarted: boolean;
  lessonSlug: string;
};

function useNextActivity(params: URLSearchParams) {
  const [data, setData] = useState<NextActivityData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_URL}/v1/progress/next-activity?${params.toString()}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((json: NextActivityData) => {
        setData(json.brandSlug ? json : null);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [params]);

  return { data, loading };
}

function ActivityLink({ data }: { data: NextActivityData }) {
  const t = useExtracted();
  const href = `/b/${data.brandSlug}/c/${data.courseSlug}/ch/${data.chapterSlug}/l/${data.lessonSlug}/a/${data.activityPosition}`;

  let label = t("Start");

  if (data.completed) {
    label = t("Review");
  } else if (data.hasStarted) {
    label = t("Continue");
  }

  return (
    <ClientLink className={cn(buttonVariants(), "w-full gap-2")} href={href}>
      {label}
      <ChevronRightIcon aria-hidden="true" />
    </ClientLink>
  );
}

export function ContinueActivityLink({
  chapterId,
  courseId,
  lessonId,
}: {
  chapterId?: number;
  courseId?: number;
  lessonId?: number;
}) {
  const t = useExtracted();
  const params = new URLSearchParams();

  if (courseId) {
    params.set("courseId", String(courseId));
  }
  if (chapterId) {
    params.set("chapterId", String(chapterId));
  }
  if (lessonId) {
    params.set("lessonId", String(lessonId));
  }

  const { data, loading } = useNextActivity(params);

  if (loading) {
    return (
      <Button className="w-full" disabled>
        {t("Start")}
      </Button>
    );
  }

  if (!data) {
    return null;
  }

  return <ActivityLink data={data} />;
}
