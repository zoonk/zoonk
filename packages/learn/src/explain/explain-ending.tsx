"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { Button, buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { BrainIcon, CircleHelpIcon, TargetIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import {
  ListGroup,
  ListRowContent,
  ListRowDescription,
  ListRowIcon,
  ListRowLeading,
  ListRowLink,
  ListRowTitle,
} from "../_components/list-group";
import { PageSectionTitle } from "../_components/page";
import { SectionLabel } from "../_components/section-label";
import { StatTile, StatTiles } from "../_components/stat-tile";
import { SuccessEyebrow } from "../_components/success-eyebrow";
import {
  TASK_MAIN_ACTION_CLASS,
  TaskActionBar,
  TaskActions,
  TaskAsideContent,
  TaskBody,
} from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { LearnLink } from "../learn-link";
import { DayMoment } from "../session/day-moment";
import { type LessonCelebration } from "../session/lesson-celebration";
import { MOMENT_TITLE_PROPS } from "../session/moment-ceremony";
import { useQuickExplanationLabel } from "./quick-explanation-label";

/**
 * What the check earned, once the explanation is saved (`celebration`, null until then): its Brain
 * Power, the day's missions it completed and the belt level and tenth of Energy it reached.
 */
type ExplainResult = { answered: number; celebration: LessonCelebration | null; correct: number };

const DONE_CLASS = cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS);

/**
 * "Done" leaves the explanation, read to the end, once its reading is saved (`saving` until then):
 * that save is what finishes the explanation, so it leaves the goal switcher. It's the task's main
 * action, in the action bar every task screen shares.
 */
function DoneLink({ href, saving }: { href: string; saving: boolean }) {
  const t = useExtracted();
  const doneRef = useEnterClick<HTMLAnchorElement>();

  if (saving) {
    return (
      <Button aria-busy className={DONE_CLASS} disabled focusableWhenDisabled>
        {t("Done")}
      </Button>
    );
  }

  return (
    <LearnLink aria-keyshortcuts="Enter" className={DONE_CLASS} href={href} ref={doneRef}>
      {t("Done")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

/** What the one question earned, as numbers on their tiles; read again, it earns nothing new. */
function ResultTiles({ result }: { result: ExplainResult }) {
  const t = useExtracted();
  // "+0" would only read as a loss.
  const brainPower = result.celebration?.brainPower ?? 0;

  if (result.answered === 0 && brainPower === 0) {
    return null;
  }

  return (
    <StatTiles className={cn("mt-3", (result.answered === 0 || brainPower === 0) && "grid-cols-1")}>
      {result.answered > 0 && (
        <StatTile
          icon={<TargetIcon />}
          label={t("Right answers")}
          tone="success"
          value={`${result.correct}/${result.answered}`}
        />
      )}
      {brainPower > 0 && (
        <StatTile
          icon={<BrainIcon />}
          label={t("Brain Power")}
          tone="brain"
          value={`+${brainPower}`}
        />
      )}
    </StatTiles>
  );
}

/**
 * A related question, as its own quick explanation. A quick explanation has no kind's color of its
 * own, so its mark is a quiet icon, lined up with the in-depth row's above it.
 */
function QuestionRow({ href, question }: { href: string; question: string }) {
  const quickExplanation = useQuickExplanationLabel();

  return (
    <ListRowLink href={href}>
      <ListRowLeading>
        <ListRowIcon>
          <CircleHelpIcon />
        </ListRowIcon>
      </ListRowLeading>
      <ListRowContent>
        <ListRowTitle>{question}</ListRowTitle>
        <ListRowDescription>{quickExplanation}</ListRowDescription>
      </ListRowContent>
    </ListRowLink>
  );
}

/**
 * The explanation in its sentences, numbered: in the column under `lg`, and from `lg` in the
 * aside, where the outline and "From the lesson" were, as a lesson's summary is at its end: from
 * the aside's top, its label drawn as the aside's header row.
 */
function ExplainRecap({ recap }: { recap: ExplanationView["recap"] }) {
  const t = useExtracted();

  if (recap.length === 0) {
    return null;
  }

  return (
    <TaskAsideContent className="lg:top-0">
      <section aria-labelledby="explain-recap" className="flex flex-col gap-1 lg:gap-0">
        <SectionLabel
          className="lg:flex lg:h-13 lg:shrink-0 lg:items-center xl:h-15"
          id="explain-recap"
        >
          {t("In {count, plural, one {# sentence} other {# sentences}}", { count: recap.length })}
        </SectionLabel>
        <ol className="flex flex-col [&>li+li]:border-t">
          {recap.map((sentence, index) => (
            <li className="flex gap-3 py-3 lg:first:pt-0" key={sentence}>
              <span
                aria-hidden="true"
                className="text-faint w-4 shrink-0 font-mono text-xs leading-relaxed tabular-nums"
              >
                {index + 1}
              </span>
              <span className="min-w-0 flex-1 text-sm leading-relaxed text-pretty">{sentence}</span>
            </li>
          ))}
        </ol>
      </section>
    </TaskAsideContent>
  );
}

/**
 * The end of a quick explanation: "✓ Now you know" over its title, what the one question earned
 * and the belt level and the tenth of Energy it reached (its milestone opened before, from the
 * lesson player's `ceremony`), the recap in three numbered sentences, and "Want to go further?":
 * learning the subject in depth as a plan of its own (the host's `deeper` control) or another
 * quick question. "Done" finishes, in the action bar at the bottom. From `lg` the recap sits in the aside, where the outline and
 * "From the lesson" were, as a lesson's summary does at its end, so the aside is never left empty
 * and the column keeps the result and the way on.
 */
export function ExplainEnding({
  buddy,
  deeper,
  doneHref,
  explanation,
  questionHref,
  result,
  saving = false,
}: {
  /** The learner's buddy, for what the ending says about its Energy. */
  buddy?: LearnBuddy | null;
  /** "I want to learn this in depth": the host's `ExplainDeeperLink`. */
  deeper: React.ReactNode;
  doneHref: string;
  explanation: Pick<ExplanationView, "goFurther" | "recap" | "title">;
  /** Where a related question starts: onboarding with the question filled in. */
  questionHref: (question: string) => string;
  result: ExplainResult;
  /** While the reading is being saved, "Done" waits for it. */
  saving?: boolean;
}) {
  const t = useExtracted();
  const { questions } = explanation.goFurther;

  return (
    <>
      <TaskBody className="gap-7" data-slot="explain-ending">
        <div className="flex flex-col gap-2" role="status">
          <SuccessEyebrow>{t("Now you know")}</SuccessEyebrow>
          <h2 className="text-title outline-none" {...MOMENT_TITLE_PROPS}>
            {explanation.title}
          </h2>
          <ResultTiles result={result} />
        </div>

        {result.celebration && (
          <DayMoment
            buddy={buddy}
            ceremony={result.celebration.ceremony}
            missionMoment={result.celebration.missionMoment}
            reached={result.celebration.reached}
          />
        )}

        <ExplainRecap recap={explanation.recap} />

        <section aria-labelledby="explain-go-further" className="flex flex-col gap-1">
          <PageSectionTitle id="explain-go-further">{t("Want to go further?")}</PageSectionTitle>

          {deeper}

          {questions.length > 0 && (
            <ListGroup>
              {questions.map((question) => (
                <QuestionRow href={questionHref(question)} key={question} question={question} />
              ))}
            </ListGroup>
          )}
        </section>
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <DoneLink href={doneHref} saving={saving} />
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
