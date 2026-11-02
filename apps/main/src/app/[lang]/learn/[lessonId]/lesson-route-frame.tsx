"use client";

import { Link } from "@/i18n/navigation";
import {
  TASK_HEADER_ICON_CLASS,
  TaskHeader,
  TaskHeaderBar,
  TaskHeaderSide,
  TaskHeaderTitle,
} from "@zoonk/learn/task-header";
import {
  TaskAside,
  TaskAsideContent,
  TaskBody,
  getTaskAsideRootProps,
} from "@zoonk/learn/task-layout";
import { useFormatDuration } from "@zoonk/learn/time-format";
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type LessonAbout = { description: string; estimatedMinutes?: number; title: string };

export function LessonRouteFrame({
  children,
  exitHref,
  footer,
  lesson,
}: {
  children: React.ReactNode;
  exitHref: string;
  footer?: React.ReactNode;
  lesson: LessonAbout;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const asideRoot = getTaskAsideRootProps();

  const minutes =
    lesson.estimatedMinutes === undefined ? undefined : formatDuration(lesson.estimatedMinutes);

  return (
    <div
      className={cn("bg-background flex min-h-dvh flex-col", asideRoot.className)}
      data-aside={asideRoot["data-aside"]}
    >
      <TaskHeader className="bg-background sticky top-0">
        <TaskHeaderBar>
          <TaskHeaderSide align="start">
            <Link
              className={cn(
                buttonVariants({ size: "icon", variant: "ghost" }),
                "shrink-0",
                TASK_HEADER_ICON_CLASS.start,
              )}
              href={exitHref}
            >
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Back")}</span>
            </Link>
          </TaskHeaderSide>

          <TaskHeaderTitle title={lesson.title} />

          <TaskHeaderSide align="end" />
        </TaskHeaderBar>
      </TaskHeader>

      <main className="flex flex-1 flex-col">
        <TaskBody>
          <TaskAsideContent>
            <p className="text-muted-foreground text-pretty">{lesson.description}</p>
          </TaskAsideContent>

          {children}
        </TaskBody>
      </main>

      {footer}

      <TaskAside label={t("About this lesson")} meta={minutes} title={t("About this lesson")} />
    </div>
  );
}
