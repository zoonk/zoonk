"use client";

import { Disclosure } from "@zoonk/learn/disclosure";
import {
  ListGroup,
  ListRow,
  ListRowContent,
  ListRowIcon,
  ListRowLeading,
  ListRowTitle,
  ListRowTrailing,
} from "@zoonk/learn/list";
import { RichTextBlocks } from "@zoonk/learn/rich-text";
import { RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { TaskAside, TaskAsideContent } from "@zoonk/learn/task-layout";
import { LessonVisual } from "@zoonk/learn/visual";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleHelpIcon, TextQuoteIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { PlayerContentFrame } from "../components/step-layouts";
import { LessonRichText } from "./_components/lesson-rich-text";
import {
  type RecapStep,
  getLessonOutline,
  getLessonRecap,
  getRecapMark,
} from "./_utils/lesson-aside";
import { getExplanationsAfter, isLanguageStep, isReadStep } from "./_utils/lesson-steps";
import { useLessonPlayer, useLessonPlayerConfig } from "./lesson-player-context";
import { type PlayableLibraryStep } from "./lesson-player-types";
import { ConversationToggle, LessonDock } from "./tutor/lesson-dock";
import { useLessonBuddy } from "./tutor/lesson-tutor";
import { useShowsMiss } from "./tutor/use-shows-miss";

/** The reading text in the aside, at the aside's quieter size and a calm line height. */
const RECAP_TEXT_CLASS = "text-foreground text-sm leading-relaxed";

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

/** A reading screen read again: its title, its text (or a worked example's steps) and its chart. */
function RecapBody({ mark, step }: { mark: string | null; step: RecapStep }) {
  const title = recapTitle(step);

  return (
    <>
      {title && (
        <h3 className="text-sm leading-snug font-semibold">
          <LessonRichText text={title} />
        </h3>
      )}

      {step.kind === "workedExample" ? (
        <WorkedExampleRecap mark={mark} step={step} />
      ) : (
        <RichTextBlocks className={RECAP_TEXT_CLASS} mark={mark} text={step.content.text} />
      )}

      <LessonVisual visual={step.content.visual} />
    </>
  );
}

/**
 * "From the lesson" beside a question from `lg`: the last reading screen before it, its title, text
 * and chart, to look back at while answering, with the sentence the question rests on marked after
 * a wrong answer. Under `lg` it folds under the question (`LessonRecapRow`).
 */
function LessonRecap({ mark, step }: { mark: string | null; step: RecapStep }) {
  return (
    <TaskAsideContent className="flex flex-col gap-3 max-lg:hidden" data-slot="lesson-recap">
      <RecapBody mark={mark} step={step} />
    </TaskAsideContent>
  );
}

/** The recap of the question in view and the sentence to mark in it, if any. */
function useScreenRecap() {
  const { screen, state } = useLessonPlayer();
  const recap = getLessonRecap(state);
  const showsMiss = useShowsMiss();
  const mark = showsMiss && screen.step ? getRecapMark({ recap, step: screen.step }) : null;

  return { mark, recap };
}

/**
 * "From the lesson" on a phone or a tablet in portrait: the same recap as the aside's, folded into
 * one row under the question (and its result once it's checked) that names the screen it holds,
 * opening in place, so looking back never leaves the question. A question asked before its
 * explanation offers that explanation instead ("Explain first"), since an earlier screen isn't
 * what it's about. Wide screens have the recap beside the question.
 */
export function LessonRecapRow() {
  const t = useExtracted();
  const { state } = useLessonPlayer();
  const { mark, recap } = useScreenRecap();

  if (!recap || getExplanationsAfter(state).length > 0) {
    return null;
  }

  const title = recapTitle(recap.step);

  return (
    <PlayerContentFrame className="pb-6 lg:hidden" data-slot="lesson-recap-row">
      <Disclosure
        description={title ? <LessonRichText text={title} /> : undefined}
        icon={
          <ListRowIcon>
            <TextQuoteIcon />
          </ListRowIcon>
        }
        title={t("From the lesson")}
      >
        <div className="flex flex-col gap-3">
          <RecapBody mark={mark} step={recap.step} />
        </div>
      </Disclosure>
    </PlayerContentFrame>
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
  return outline && !isLanguageStep(step) && isReadStep(step);
}

/**
 * The aside beside a screen from `lg`, with what helps with it (what the screen shows itself, its
 * situation, picture or chart, stays with it in the column): beside a question, the last reading
 * screen ("From the lesson", with its place in the lesson); beside a reading screen, the lesson's
 * outline when the host asks for it; and the buddy's composer at its foot, level with the action
 * bar.
 */
function ScreenAside({ step }: { step: PlayableLibraryStep }) {
  const t = useExtracted();
  const buddy = useLessonBuddy();
  const { mark, recap } = useScreenRecap();
  const showsOutline = useShowsOutline(step);

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
                  className="text-faint w-4 shrink-0 font-mono text-xs leading-6 tabular-nums"
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
 * The lesson's aside from `lg` (tablets in landscape and up), at the window's right edge behind a
 * hairline, there on every screen so the screen's column stays in one place from the first screen
 * to the end. Once the lesson is done, the player's own moment shows the lesson's ideas there,
 * while a host's moment (a session block's queue, a quick explanation's recap) fills the aside
 * itself.
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
