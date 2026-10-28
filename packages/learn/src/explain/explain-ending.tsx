"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { buttonVariants } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { useEnterClick } from "@zoonk/ui/hooks/keyboard";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleHelpIcon } from "lucide-react";
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
import { MomentReadouts } from "../_components/moment-readouts";
import { PageSectionTitle } from "../_components/page";
import { SectionLabel } from "../_components/section-label";
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
import { MomentHeader, MomentSaving, PendingMainAction } from "../session/moment-header";
import { useQuickExplanationLabel } from "./quick-explanation-label";

type ExplainResult = { answered: number; celebration: LessonCelebration | null; correct: number };

function DoneLink({ href, saving }: { href: string; saving: boolean }) {
  const t = useExtracted();
  const doneRef = useEnterClick<HTMLAnchorElement>();

  if (saving) {
    return <PendingMainAction>{t("Done")}</PendingMainAction>;
  }

  return (
    <LearnLink
      aria-keyshortcuts="Enter"
      className={cn(buttonVariants({ size: "xl" }), TASK_MAIN_ACTION_CLASS)}
      href={href}
      ref={doneRef}
    >
      {t("Done")}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </LearnLink>
  );
}

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

function ExplainRecap({
  className,
  recap,
}: {
  className?: string;
  recap: ExplanationView["recap"];
}) {
  const t = useExtracted();

  if (recap.length === 0) {
    return null;
  }

  return (
    <TaskAsideContent className={cn("lg:top-0", className)}>
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

export function ExplainEnding({
  buddy,
  deeper,
  doneHref,
  explanation,
  questionHref,
  result,
  saving = false,
}: {
  buddy?: LearnBuddy | null;
  deeper: React.ReactNode;
  doneHref: string;
  explanation: Pick<ExplanationView, "goFurther" | "recap" | "title">;
  questionHref: (question: string) => string;
  result: ExplainResult;
  saving?: boolean;
}) {
  const t = useExtracted();
  const { questions } = explanation.goFurther;

  return (
    <>
      <TaskBody className="gap-7" data-slot="explain-ending">
        <div className="flex flex-col gap-6">
          <MomentHeader
            eyebrow={<SuccessEyebrow>{t("Now you know")}</SuccessEyebrow>}
            title={explanation.title}
          >
            {saving ? (
              <MomentSaving />
            ) : (
              <MomentReadouts
                brainPower={result.celebration?.brainPower ?? 0}
                score={{ answered: result.answered, correct: result.correct }}
              />
            )}
          </MomentHeader>

          {result.celebration && (
            <DayMoment
              buddy={buddy}
              ceremony={result.celebration.ceremony}
              missionMoment={result.celebration.missionMoment}
              reached={result.celebration.reached}
            />
          )}
        </div>

        <ExplainRecap className={cn(saving && "max-lg:hidden")} recap={explanation.recap} />

        {!saving && (
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
        )}
      </TaskBody>

      <TaskActionBar>
        <TaskActions>
          <DoneLink href={doneHref} saving={saving} />
        </TaskActions>
      </TaskActionBar>
    </>
  );
}
