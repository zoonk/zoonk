"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { Button } from "@zoonk/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerPopup,
  DrawerTitle,
} from "@zoonk/ui/components/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@zoonk/ui/components/dropdown-menu";
import { cn } from "@zoonk/ui/lib/utils";
import { BookOpenIcon, EllipsisIcon, XIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { TASK_HEADER_ICON_CLASS, TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { useFormatDuration } from "../../_utils/time-format";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { MomentAfterCeremony, type MomentCeremony } from "../../session/moment-ceremony";
import { TaskFrame, TaskMainButton, TaskMainLink, TaskSaveError } from "../../shell/task-frame";
import { PatternDrillQuestion, PatternDrillResult } from "./pattern-drill";
import { PatternIntro, PatternRule, PatternSlip, TyposNote } from "./pattern-intro";
import {
  type PatternDrillAnswers,
  type PatternPracticeResult,
  usePatternDrill,
} from "./use-pattern-drill";

export type { PatternPracticeResult } from "./use-pattern-drill";

/** The host saves the drill's answers through core; null when that didn't go through. */
type LanguagePatternActions = {
  /** Takes the pattern off Today without a drill, once its typos note was read. */
  dismiss: () => Promise<void>;
  practice: (drill: PatternDrillAnswers) => Promise<PatternPracticeResult | null>;
};

const PERCENT = 100;
const DRILL_MINUTES = 3;

/** Leaving the pattern once it's done, as the task's one main action. */
function DoneAction({ exitHref }: { exitHref: string }) {
  const t = useExtracted();

  return (
    <TaskActions>
      <TaskMainLink href={exitHref} toApp>
        {t("Done")}
      </TaskMainLink>
    </TaskActions>
  );
}

/** A note that the mistakes were only typos: reading it is all it asks, so it leaves Today. */
function TyposPattern({
  dismiss,
  exitHref,
  pattern,
}: {
  dismiss: () => Promise<void>;
  exitHref: string;
  pattern: MistakePatternView;
}) {
  const t = useExtracted();

  useEffect(() => {
    void dismiss();
  }, [dismiss]);

  return (
    <TaskFrame
      exitHref={exitHref}
      exitToApp
      footer={<DoneAction exitHref={exitHref} />}
      headerTitle={<TaskHeaderTitle title={t("Mistake pattern")} />}
    >
      <TyposNote pattern={pattern} />
    </TaskFrame>
  );
}

/**
 * The drill's "…" under `lg`, where the rule isn't beside the question: "See the rule" opens it in
 * a sheet, with the learner's own slip under it.
 */
function RuleMenu({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  return (
    <div className="lg:hidden">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              className={cn("shrink-0", TASK_HEADER_ICON_CLASS.end)}
              size="icon"
              variant="ghost"
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
          <span className="sr-only">{t("Screen options")}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setOpen(true)}>
            <BookOpenIcon aria-hidden="true" />
            {t("See the rule")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerPopup>
          <DrawerHeader className="flex-row items-start justify-between gap-3">
            <DrawerTitle className="text-xl font-semibold">{pattern.title}</DrawerTitle>
            <DrawerClose render={<Button className="-mr-2" size="icon" variant="ghost" />}>
              <XIcon aria-hidden="true" />
              <span className="sr-only">{t("Close")}</span>
            </DrawerClose>
          </DrawerHeader>

          <DrawerContent className="flex flex-col gap-6 pt-2">
            <PatternRule pattern={pattern} />
            <PatternSlip pattern={pattern} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </div>
  );
}

/**
 * A mistake pattern, full screen: the rule ("We noticed a pattern") led by one of the learner's
 * own mistakes, a three-minute fill-in-the-blank drill one sentence at a time (pick, then Check,
 * as a lesson asks), and the result. While drilling, the rule and the learner's slip sit beside
 * the question on a wide screen and a tap away in the "…" on smaller ones. A milestone the drill
 * earned opens before its result, on its own. A pattern that was only typos gets the kind note and
 * Done. Leaving goes back where the pattern was opened (Today, a unit).
 *
 * ```tsx
 * <LanguagePatternScreen actions={actions} exitHref="/today" pattern={pattern} />
 * ```
 */
export function LanguagePatternScreen({
  actions,
  buddy,
  exitHref,
  pattern,
  renderCeremony,
}: {
  actions: LanguagePatternActions;
  /** The learner's buddy, glad about the missions the drill completes. */
  buddy?: LearnBuddy | null;
  exitHref: string;
  pattern: MistakePatternView;
  /** The full-screen moment for a milestone the drill earned (a new belt, new glasses). */
  renderCeremony?: MomentCeremony;
}) {
  const t = useExtracted();
  const formatDuration = useFormatDuration();
  const drill = usePatternDrill({ drill: pattern.drill, practice: actions.practice });
  const { step } = drill;

  if (pattern.kind === "typos" || pattern.drill.length === 0) {
    return <TyposPattern dismiss={actions.dismiss} exitHref={exitHref} pattern={pattern} />;
  }

  if (step.kind === "result") {
    return (
      <MomentAfterCeremony milestone={step.result.ceremony} render={renderCeremony}>
        <TaskFrame
          exitHref={exitHref}
          exitToApp
          footer={<DoneAction exitHref={exitHref} />}
          headerTitle={<TaskHeaderTitle title={pattern.title} />}
        >
          <PatternDrillResult buddy={buddy} result={step.result} />
        </TaskFrame>
      </MomentAfterCeremony>
    );
  }

  if (step.kind === "intro" || !drill.question) {
    return (
      <TaskFrame
        exitHref={exitHref}
        exitToApp
        footer={
          <TaskActions>
            <TaskMainButton onClick={drill.start}>
              {t("Practice this · {time}", { time: formatDuration(DRILL_MINUTES) })}
            </TaskMainButton>
          </TaskActions>
        }
        headerTitle={<TaskHeaderTitle title={t("Mistake pattern")} />}
      >
        <PatternIntro pattern={pattern} />
      </TaskFrame>
    );
  }

  const isLast = drill.index + 1 === pattern.drill.length;
  const checked = drill.answer !== null;

  const position = t("Question {current, number} of {total, number}", {
    current: drill.index + 1,
    total: pattern.drill.length,
  });

  return (
    <TaskFrame
      aside={{
        children: (
          <>
            <PatternRule pattern={pattern} />
            <PatternSlip pattern={pattern} />
          </>
        ),
        label: t("The rule"),
        title: t("The rule"),
      }}
      exitHref={exitHref}
      exitToApp
      footer={
        <>
          {drill.failed && <TaskSaveError onRetry={drill.retry} />}
          <TaskActions>
            {checked ? (
              <TaskMainButton busy={drill.isSaving} onClick={drill.next}>
                {isLast ? t("See how you did") : t("Continue")}
              </TaskMainButton>
            ) : (
              <TaskMainButton disabled={drill.picked === null} onClick={drill.check}>
                {t("Check")}
              </TaskMainButton>
            )}
          </TaskActions>
        </>
      }
      headerEnd={<RuleMenu pattern={pattern} />}
      headerTitle={<TaskHeaderTitle title={pattern.title} />}
      progress={{
        label: position,
        segments: drill.segments,
        value: ((drill.index + (checked ? 1 : 0)) / pattern.drill.length) * PERCENT,
      }}
    >
      <PatternDrillQuestion
        answer={drill.answer}
        index={drill.index}
        key={drill.index}
        onPick={drill.pick}
        picked={drill.picked}
        question={drill.question}
      />
    </TaskFrame>
  );
}
