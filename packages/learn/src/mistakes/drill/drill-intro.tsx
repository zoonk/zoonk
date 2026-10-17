"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
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
import { type Drill, type LessonHref } from "./drill-types";
import { useDrillLine } from "./use-drill-line";

type DrillLesson = NonNullable<Drill["lesson"]>;

/** Each drill's rule has its own mark, so the note reads at a glance. */
const DRILL_ICON: Readonly<Record<Drill["kind"], LucideIcon>> = {
  noGuessing: HandIcon,
  readCarefully: EyeIcon,
  reteach: LightbulbIcon,
  retry: RotateCcwIcon,
  spotTheTrap: TriangleAlertIcon,
  timed: TimerIcon,
};

/** The whole lesson a tap away in a new tab, so the drill waits where it is. */
export function LessonLink({
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

  useEnterKey(onStart);

  return <EnterButton onClick={onStart}>{t("Start the questions")}</EnterButton>;
}

/**
 * A content gap's idea, back before its questions, on a screen of its own: what the drill is for,
 * the lesson's name as the title, its ideas as one flat numbered list, the whole lesson a tap away,
 * and one button (or Enter) to start at the end of the column.
 */
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
            <p className="text-label">{drillLine(drill)}</p>
            <h2 className="text-title">{lesson.title}</h2>
          </div>

          <ol className="flex w-full flex-col leading-relaxed [&>li+li]:border-t">
            {lesson.ideas.map((idea, index) => (
              <li className="flex gap-3 py-2.75" key={idea}>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground w-4 shrink-0 font-mono text-sm leading-relaxed tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1 text-pretty">{idea}</span>
              </li>
            ))}
          </ol>

          {lessonHref && <LessonLink lesson={lesson} lessonHref={lessonHref} />}
        </section>
      </div>

      <div className="flex flex-col pt-6">
        <StartButton onStart={onStart} />
      </div>
    </div>
  );
}

/**
 * How a mistake's drill works, as a note above its first question: its rule with its own mark,
 * and the learner's last answer when the host has it. A content gap without ideas to show links
 * its lesson instead. "Try it again" alone says nothing a question doesn't, so a plain retry only
 * shows with the last answer. The rule is for answering, so once the question is graded
 * (`answered`) only the last answer and the lesson stay: "There's a trap in here" beside a blank
 * answer would claim a trap nobody looked for.
 */
function DrillNote({
  answered,
  drill,
  lastAnswer,
  lessonHref,
}: {
  answered: boolean;
  drill: Drill;
  lastAnswer: string | null;
  lessonHref: LessonHref | null;
}) {
  const t = useExtracted();
  const drillLine = useDrillLine();
  const Icon = DRILL_ICON[drill.kind];
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  if (drill.kind === "retry" && !lastAnswer) {
    return null;
  }

  if (answered && !lastAnswer && !(lesson && lessonHref)) {
    return null;
  }

  return (
    <Callout>
      <Icon aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        {!answered && <p className="font-medium">{drillLine(drill)}</p>}

        {lastAnswer && (
          <p className="text-muted-foreground">
            {t("Last time you answered: {answer}", { answer: lastAnswer })}
          </p>
        )}

        {lesson && lessonHref && <LessonLink lesson={lesson} lessonHref={lessonHref} />}
      </div>
    </Callout>
  );
}

/**
 * How a mistake's drill works, said before its first question, with the learner's last answer when
 * the host has it. A content gap's drill shows the idea first; with `onStart` it is a screen of its
 * own, and its button (or Enter) starts the questions.
 */
export function DrillIntro({
  answered = false,
  drill,
  lastAnswer = null,
  lessonHref,
  onStart,
}: {
  /** The question below is graded: the drill's rule has done its job. */
  answered?: boolean;
  drill: Drill;
  lastAnswer?: string | null;
  lessonHref: LessonHref | null;
  onStart?: () => void;
}) {
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  if (onStart && lesson && lesson.ideas.length > 0) {
    return <IdeaScreen drill={drill} lesson={lesson} lessonHref={lessonHref} onStart={onStart} />;
  }

  if (!onStart) {
    return (
      <DrillNote
        answered={answered}
        drill={drill}
        lastAnswer={lastAnswer}
        lessonHref={lessonHref}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <DrillNote answered={false} drill={drill} lastAnswer={lastAnswer} lessonHref={lessonHref} />
      <StartButton onStart={onStart} />
    </div>
  );
}
