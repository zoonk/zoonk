"use client";

import { Link } from "@/i18n/navigation";
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
import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { XIcon } from "lucide-react";
import { useExtracted } from "next-intl";

type LessonAbout = { description: string; estimatedMinutes?: number; title: string };

function LessonExit({ href }: { href: string }) {
  const t = useExtracted();

  return (
    <Link
      className={cn(buttonVariants({ edge: "start", size: "icon", variant: "ghost" }), "shrink-0")}
      href={href}
    >
      <XIcon aria-hidden="true" />
      <span className="sr-only">{t("Back")}</span>
    </Link>
  );
}

export function LessonRouteFrame({
  children,
  exitHref,
  footer,
  lead,
  lesson,
}: {
  children: React.ReactNode;
  exitHref: string;
  footer?: React.ReactNode;
  lead?: React.ReactNode;
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
              <LessonExit href={exitHref} />
            </WaitTopBarBack>
          </TaskHeaderSide>

          <TaskHeaderTitle title={lesson.title} />

          <TaskHeaderSide align="end" />
        </TaskHeaderBar>
      </TaskHeader>

      <main className="flex flex-1 flex-col">
        <TaskBody>
          {lead}

          <TaskAsideContent>
            <p
              className={cn(
                "text-muted-foreground text-pretty",
                lead && "with-aside:block hidden text-sm",
              )}
            >
              {lesson.description}
            </p>
          </TaskAsideContent>

          {children}
        </TaskBody>
      </main>

      {footer}

      <TaskAside label={t("About this lesson")} meta={minutes} title={t("About this lesson")} />
    </div>
  );
}
