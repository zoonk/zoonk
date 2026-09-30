"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { ExternalLinkIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterButton } from "../../_components/enter-button";
import { type Drill, type LessonHref } from "./drill-types";
import { useDrillLine } from "./use-drill-line";

type DrillLesson = NonNullable<Drill["lesson"]>;

/**
 * The idea a content gap missed, back before its questions: the lesson's summary card, and the
 * whole lesson a tap away in a new tab, so the drill waits where it is.
 */
function IdeaCard({ lesson, lessonHref }: { lesson: DrillLesson; lessonHref: LessonHref | null }) {
  const t = useExtracted();

  return (
    <div className="bg-background in-data-[mode=fun]:fun-paper flex flex-col gap-2 rounded-xl p-4 text-sm">
      <h2 className="text-base font-semibold">{lesson.title}</h2>

      {lesson.ideas.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 leading-relaxed">
          {lesson.ideas.map((idea) => (
            <li key={idea}>{idea}</li>
          ))}
        </ul>
      )}

      {lessonHref && (
        <a
          className="inline-flex min-h-11 w-fit items-center gap-1.5 font-medium underline underline-offset-4"
          href={lessonHref(lesson.id)}
          rel="noopener"
          target="_blank"
        >
          {t("Go over the lesson")}
          <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
          <span className="sr-only">{t("(opens in a new tab)")}</span>
        </a>
      )}
    </div>
  );
}

function StartButton({ onStart }: { onStart: () => void }) {
  const t = useExtracted();

  useEnterKey(onStart);

  return <EnterButton onClick={onStart}>{t("Start the questions")}</EnterButton>;
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
  const t = useExtracted();
  const drillLine = useDrillLine();
  const lesson = drill.kind === "reteach" ? drill.lesson : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted in-data-[mode=fun]:fun-glass flex flex-col gap-3 rounded-2xl p-4 text-sm">
        <p className="font-medium">{drillLine(drill)}</p>

        {lastAnswer && (
          <p className="text-muted-foreground">
            {t("Last time you answered: {answer}", { answer: lastAnswer })}
          </p>
        )}

        {lesson && <IdeaCard lesson={lesson} lessonHref={lessonHref} />}
      </div>

      {onStart && <StartButton onStart={onStart} />}
    </div>
  );
}
