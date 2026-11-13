"use client";

import { type MistakePatternView } from "@zoonk/core/language/patterns/contract";
import { Drawer, DrawerContent, DrawerPopup, DrawerTitle } from "@zoonk/ui/components/drawer";
import { DropdownMenuItem } from "@zoonk/ui/components/dropdown-menu";
import { BookOpenIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useEffect, useState } from "react";
import { QuestionActions, QuestionMainAction } from "../../_components/question-actions";
import { AnswersSaveError } from "../../_components/save-error";
import { SheetHeader } from "../../_components/sheet-header";
import { TaskHeaderMenu, TaskHeaderTitle } from "../../_components/task-header";
import { TaskActions } from "../../_components/task-layout";
import { useFormatDuration } from "../../_utils/time-format";
import { type LearnBuddy } from "../../buddies/use-buddy-name";
import { MomentAfterCeremony, type MomentCeremony } from "../../session/moment-ceremony";
import { TaskFrame, TaskMainButton, TaskMainLink } from "../../shell/task-frame";
import { PatternDrillQuestion, PatternDrillResult } from "./pattern-drill";
import { PatternIntro, PatternRule, PatternSlip, TyposNote } from "./pattern-intro";
import {
  type PatternDrillAnswers,
  type PatternPracticeResult,
  usePatternDrill,
} from "./use-pattern-drill";

export type { PatternPracticeResult } from "./use-pattern-drill";

/** `practice` resolves to null when the save didn't go through. */
type LanguagePatternActions = {
  dismiss: () => Promise<void>;
  practice: (drill: PatternDrillAnswers) => Promise<PatternPracticeResult | null>;
};

const PERCENT = 100;
const DRILL_MINUTES = 3;

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

function RuleMenu({ pattern }: { pattern: MistakePatternView }) {
  const t = useExtracted();
  const [open, setOpen] = useState(false);

  return (
    <div className="with-aside:hidden">
      <TaskHeaderMenu>
        <DropdownMenuItem onClick={() => setOpen(true)}>
          <BookOpenIcon aria-hidden="true" />
          {t("See the rule")}
        </DropdownMenuItem>
      </TaskHeaderMenu>

      <Drawer onOpenChange={setOpen} open={open}>
        <DrawerPopup>
          <SheetHeader>
            <DrawerTitle>{pattern.title}</DrawerTitle>
          </SheetHeader>

          <DrawerContent className="flex flex-col gap-6 pt-2">
            <PatternRule pattern={pattern} />
            <PatternSlip pattern={pattern} />
          </DrawerContent>
        </DrawerPopup>
      </Drawer>
    </div>
  );
}

export function LanguagePatternScreen({
  actions,
  buddy,
  exitHref,
  pattern,
  renderCeremony,
}: {
  actions: LanguagePatternActions;
  buddy?: LearnBuddy | null;
  exitHref: string;
  pattern: MistakePatternView;
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
      <MomentAfterCeremony moments={step.result} render={renderCeremony}>
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
          {drill.failures > 0 && !drill.isSaving && (
            <AnswersSaveError failures={drill.failures} onRetry={drill.retry} />
          )}
          <QuestionActions>
            {checked ? (
              <QuestionMainAction
                action={isLast ? "seeResult" : "continue"}
                busy={drill.isSaving}
                onPress={drill.next}
              />
            ) : (
              <QuestionMainAction
                action="check"
                disabled={drill.picked === null}
                onPress={drill.check}
              />
            )}
          </QuestionActions>
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
