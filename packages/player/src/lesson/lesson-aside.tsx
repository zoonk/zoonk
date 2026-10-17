"use client";

import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { TaskAside, TaskAsideContent } from "@zoonk/learn/task-layout";
import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleHelpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { LessonRichText } from "./_components/lesson-rich-text";
import { useHasOwnSupport } from "./_components/screen-support";
import {
  type RecapStep,
  getLessonOutline,
  getLessonRecap,
  getRecapMark,
} from "./_utils/lesson-aside";
import { isLanguageStep, isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { ConversationToggle, LessonDock } from "./tutor/lesson-dock";
import { useLessonBuddy } from "./tutor/lesson-tutor";
import { useShowsMiss } from "./tutor/use-shows-miss";

/** The reading text in the aside: a step under the screen's own, at a calm line height. */
const RECAP_TEXT_CLASS = "text-foreground text-[0.9375rem] leading-[1.6]";

/** A worked example read again: its problem, every step and its result, compact. */
function WorkedExampleRecap({
  mark,
  step,
}: {
  mark: string | null;
  step: Extract<RecapStep, { kind: "workedExample" }>;
}) {
  const t = useExtracted();
  const { content } = step;

  return (
    <>
      <RichTextBlocks className={RECAP_TEXT_CLASS} mark={mark} text={content.problem} />

      <ol aria-label={t("Steps")} className="flex flex-col gap-2">
        {content.steps.map((line, index) => {
          const key = `step-${index}`;

          return (
            <li className={cn("flex gap-2.5", RECAP_TEXT_CLASS)} key={key}>
              <span
                aria-hidden="true"
                className="text-muted-foreground font-mono text-xs leading-6 tabular-nums"
              >
                {index + 1}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <RichTextBlocks mark={mark} text={line.text} />
                {line.math && (
                  <RichInlineSegments segments={[{ kind: "displayMath", text: line.math }]} />
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className={RECAP_TEXT_CLASS}>
        <span className="text-muted-foreground font-medium">{t("Result")}</span>{" "}
        <LessonRichText mark={mark} text={content.result} />
      </p>
    </>
  );
}

function recapTitle(step: RecapStep): string | null {
  if (step.kind === "hook") {
    return null;
  }

  return step.content.title ?? null;
}

/**
 * "From the lesson" beside a question from `lg`: the last reading screen before it, its title, text
 * and chart, to look back at while answering, with the sentence the question rests on marked after
 * a wrong answer. Wide screens only; a phone turns back a screen.
 */
function LessonRecap({ mark, step }: { mark: string | null; step: RecapStep }) {
  const title = recapTitle(step);

  return (
    <TaskAsideContent className="flex flex-col gap-3 max-lg:hidden" data-slot="lesson-recap">
      {title && (
        <h3 className="text-[0.9375rem] leading-snug font-semibold">
          <LessonRichText text={title} />
        </h3>
      )}

      {step.kind === "workedExample" ? (
        <WorkedExampleRecap mark={mark} step={step} />
      ) : (
        <RichTextBlocks className={RECAP_TEXT_CLASS} mark={mark} text={step.content.text} />
      )}

      <LessonVisual visual={step.content.visual} />
    </TaskAsideContent>
  );
}

/**
 * The lesson's outline beside a reading screen, for a short story (a quick explanation): its
 * screens by number and title, the one in view highlighted, the ones read checked, then the
 * questions at the end.
 */
function LessonOutline() {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const { questions, rows } = getLessonOutline(state);

  return (
    <ListGroup aria-label={t("Outline")} role="list">
      {rows.map((row) => (
        <ListRow
          aria-current={row.state === "current" ? "step" : undefined}
          key={row.id}
          role="listitem"
        >
          <ListRowLeading>
            <span className="text-faint w-4 font-mono text-xs tabular-nums">{row.number}</span>
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle className={cn(row.state === "read" && "text-muted-foreground")}>
              <LessonRichText text={row.title} />
              {row.state === "read" && <span className="sr-only">{t(", read")}</span>}
            </ListRowTitle>
          </ListRowContent>
          {row.state === "read" && (
            <ListRowTrailing>
              <CheckIcon aria-hidden="true" className="text-faint size-3.5" />
            </ListRowTrailing>
          )}
        </ListRow>
      ))}

      {questions > 0 && (
        <ListRow role="listitem">
          <ListRowLeading>
            <CircleHelpIcon aria-hidden="true" className="text-muted-foreground size-4" />
          </ListRowLeading>
          <ListRowContent>
            <ListRowTitle className="text-muted-foreground font-normal">
              {t(
                "{count, plural, one {# quick question at the end} other {# quick questions at the end}}",
                { count: questions },
              )}
            </ListRowTitle>
          </ListRowContent>
        </ListRow>
      )}
    </ListGroup>
  );
}

/** Whether a reading screen shows the lesson's outline beside it: when the host asks for it. */
function useShowsOutline(step: PlayableLibraryStep): boolean {
  const { outline } = useLessonPlayerConfig();
  const hasOwnSupport = useHasOwnSupport(step);

  return outline && !hasOwnSupport && !isLanguageStep(step) && isReadStep(step);
}

/** The recap a question shows beside it, unless it has support of its own to show there. */
function useScreenRecap(step: PlayableLibraryStep) {
  const { state } = useLessonPlayer();
  const hasOwnSupport = useHasOwnSupport(step);

  return hasOwnSupport ? null : getLessonRecap(state);
}

/**
 * The aside beside a screen from `lg`: the question's own support or, without any, the last reading
 * screen ("From the lesson", with its place in the lesson); a reading screen's picture, chart or
 * activity, or the lesson's outline when the host asks for it; and the buddy's composer at its
 * foot, level with the action bar.
 */
function ScreenAside({ step }: { step: PlayableLibraryStep }) {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const recap = useScreenRecap(step);
  const showsOutline = useShowsOutline(step);
  const mark = useShowsMiss() ? getRecapMark({ recap, step }) : null;

  const screenNumber = recap
    ? t("screen {number}", { number: String(recap.position + 1) })
    : undefined;

  return (
    <TaskAside
      label={t("Help with this screen")}
      meta={buddy ? <ConversationToggle fallback={screenNumber} /> : screenNumber}
      title={(recap && t("From the lesson")) || (showsOutline && t("Outline")) || undefined}
    >
      {recap && <LessonRecap mark={mark} step={recap.step} />}
      {showsOutline && <LessonOutline />}
      {buddy && <LessonDock />}
    </TaskAside>
  );
}

/** The lesson's ideas beside its completion moment, one sentence each, to keep. */
function CompletionAside() {
  const t = useExtracted();
  const { lesson } = useLessonPlayerConfig();
  const ideas = lesson.summaryIdeas;

  return (
    <TaskAside
      label={t("Lesson summary")}
      title={ideas.length > 0 ? t("Lesson summary") : undefined}
    >
      {ideas.length > 0 && (
        <ol className="divide-border flex flex-col divide-y">
          {ideas.map((idea, index) => {
            const key = `idea-${index}`;

            return (
              <li className="flex gap-3 py-3 text-sm leading-relaxed first:pt-0" key={key}>
                <span
                  aria-hidden="true"
                  className="text-muted-foreground w-4 shrink-0 font-mono text-xs leading-6 tabular-nums"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <LessonRichText text={idea} />
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </TaskAside>
  );
}

/**
 * The lesson's aside from `lg` (tablets in landscape and up), full height beside the screen behind
 * a hairline, so the screen's column stays in one place from the first screen to the end. Once the
 * lesson is done, the player's own moment shows the lesson's ideas there, while a host's moment (a
 * session block's) fills the aside itself.
 */
export function LessonAside() {
  const t = useExtracted();
  const { slots } = useLessonPlayerConfig();
  const { screen, state } = useLessonPlayer();

  if (state.phase === "completed") {
    return slots.completion ? (
      <TaskAside label={t("Help with this screen")} />
    ) : (
      <CompletionAside />
    );
  }

  if (state.run.status === "refused" || !screen.step) {
    return <TaskAside label={t("Help with this screen")} />;
  }

  return <ScreenAside step={screen.step} />;
}
