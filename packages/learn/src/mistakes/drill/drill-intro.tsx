"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
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
import { KindTile } from "../../_components/kind-tile";
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
function LessonLink({ lesson, lessonHref }: { lesson: DrillLesson; lessonHref: LessonHref }) {
  const t = useExtracted();

  return (
    <a
      className="inline-flex min-h-11 w-fit items-center gap-1.5 text-sm font-medium underline underline-offset-4"
      href={lessonHref(lesson.id)}
      rel="noopener"
      target="_blank"
    >
      {t("Go over the lesson")}
      <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
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
 * A content gap's idea, back before its questions, on a screen of its own: the lesson's name big,
 * its ideas on a soft panel, the whole lesson a tap away, and one button (or Enter) to start. On
 * phones the button sits at the bottom; on wide screens it stays right under the card.
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
    <div className="flex flex-1 flex-col lg:justify-center-safe">
      <div className="flex flex-1 flex-col justify-center lg:flex-none">
        <section className="flex flex-col items-center gap-5 text-center">
          <KindTile icon={LightbulbIcon} kind="lesson" size="lg" />

          <div className="flex flex-col items-center gap-1.5">
            <p className="text-muted-foreground text-sm font-medium text-balance">
              {drillLine(drill)}
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-balance">{lesson.title}</h2>
          </div>

          <ul className="bg-muted/60 flex w-full list-disc flex-col gap-2 rounded-2xl py-4 pr-4 pl-9 text-left leading-relaxed">
            {lesson.ideas.map((idea) => (
              <li key={idea}>{idea}</li>
            ))}
          </ul>

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
 * shows with the last answer.
 */
function DrillNote({
  drill,
  lastAnswer,
  lessonHref,
}: {
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

  return (
    <Callout>
      <Icon aria-hidden="true" />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-medium">{drillLine(drill)}</p>

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
  drill,
  lastAnswer = null,
  lessonHref,
  onStart,
}: {
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
    return <DrillNote drill={drill} lastAnswer={lastAnswer} lessonHref={lessonHref} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <DrillNote drill={drill} lastAnswer={lastAnswer} lessonHref={lessonHref} />
      <StartButton onStart={onStart} />
    </div>
  );
}
