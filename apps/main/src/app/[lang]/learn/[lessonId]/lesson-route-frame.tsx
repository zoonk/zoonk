"use client";

import { Link } from "@/i18n/navigation";
import { TaskClose } from "@zoonk/learn/task-close";
import {
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
import { WaitTopBarBack } from "@zoonk/learn/wait";
import { cn } from "@zoonk/ui/lib/utils";
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
            <WaitTopBarBack>
              <TaskClose href={exitHref} link={Link} />
            </WaitTopBarBack>
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
