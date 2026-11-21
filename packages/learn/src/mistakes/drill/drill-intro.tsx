"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import {
  ExternalLinkIcon,
  EyeIcon,
  HandIcon,
  LightbulbIcon,
  type LucideIcon,
  RotateCcwIcon,
  TimerIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../../_components/callout";
import { EnterButton } from "../../_components/enter-button";
import { LessonSummaryIdeas } from "../../_components/lesson-summary-ideas";
import { type Drill, type LessonHref } from "./drill-types";
import { useDrillLine } from "./use-drill-line";

type DrillLesson = NonNullable<Drill["lesson"]>;

const DRILL_ICON: Readonly<Record<Drill["kind"], LucideIcon>> = {
  noGuessing: HandIcon,
  readCarefully: EyeIcon,
  reteach: LightbulbIcon,
  retry: RotateCcwIcon,
  spotTheTrap: TriangleAlertIcon,
  timed: TimerIcon,
};

function LessonLink({
  className,
  lesson,
  lessonHref,
}: {
  className?: string;
  lesson: DrillLesson;
  lessonHref: LessonHref;
}) {
  const t = useExtracted();

  return (
    <a
      className={cn(buttonVariants({ size: "sm", variant: "outline" }), "w-fit", className)}
      href={lessonHref(lesson.id)}
      rel="noopener"
      target="_blank"
    >
      {t("Go over the lesson")}
      <ExternalLinkIcon aria-hidden="true" data-icon="inline-end" />
      <span className="sr-only">{t("(opens in a new tab)")}</span>
    </a>
  );
}

function StartButton({ onStart }: { onStart: () => void }) {
  const t = useExtracted();

  return <EnterButton onClick={onStart}>{t("Start the questions")}</EnterButton>;
}

function IdeaScreen({
  drill,
  lesson,
  lessonHref,
  onStart,
}: {
  drill: Drill;
  lesson: DrillLesson;
  lessonHref: LessonHref | null;
  onStart: () => void;
}) {
  const drillLine = useDrillLine();

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col">
        <section className="flex flex-col items-start gap-5">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-title">{lesson.title}</h2>
            <p className="text-muted-foreground">{drillLine(drill)}</p>
          </div>

          <LessonSummaryIdeas ideas={lesson.ideas} />

          {lessonHref && <LessonLink lesson={lesson} lessonHref={lessonHref} />}
        </section>
      </div>

      <div className="flex flex-col pt-6">
        <StartButton onStart={onStart} />
      </div>
    </div>
  );
}

function DrillNote({
  answered,
  drill,
  lessonHref,
}: {
  answered: boolean;
  drill: Drill;
  lessonHref: LessonHref | null;
}) {
  const drillLine = useDrillLine();
  const Icon = DRILL_ICON[drill.kind];
  const line = answered ? null : drillLine(drill);
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  if (lesson && lessonHref) {
    return <LessonLink lesson={lesson} lessonHref={lessonHref} />;
  }

  if (!line) {
    return null;
  }

  return (
    <Callout>
      <Icon aria-hidden="true" />
      <p className="font-medium">{line}</p>
    </Callout>
  );
}

export function DrillIntro({
  answered = false,
  drill,
  lessonHref,
  onStart,
}: {
  answered?: boolean;
  drill: Drill;
  lessonHref: LessonHref | null;
  onStart?: () => void;
}) {
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  if (onStart && lesson && lesson.ideas.length > 0) {
    return <IdeaScreen drill={drill} lesson={lesson} lessonHref={lessonHref} onStart={onStart} />;
  }

  if (!onStart) {
    return <DrillNote answered={answered} drill={drill} lessonHref={lessonHref} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DrillNote answered={false} drill={drill} lessonHref={lessonHref} />
      <StartButton onStart={onStart} />
    </div>
  );
}
