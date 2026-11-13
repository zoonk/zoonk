"use client";

import { type ExplanationView } from "@zoonk/core/view-models/explain/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { CircleHelpIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { EnterLink } from "../_components/enter-button";
import { SuccessEyebrow } from "../_components/eyebrow";
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
import { PAGE_SECTION_TITLE_CLASS, PageSectionTitle } from "../_components/page";
import { TaskActionBar, TaskActions, TaskAsideContent, TaskBody } from "../_components/task-layout";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { DayMoment } from "../session/day-moment";
import { type LessonCelebration } from "../session/lesson-celebration";
import { MomentHeader, MomentSaving, PendingMainAction } from "../session/moment-header";
import { useQuickExplanationLabel } from "./quick-explanation-label";

type ExplainResult = { answered: number; celebration: LessonCelebration | null; correct: number };

function DoneLink({ href, saving }: { href: string; saving: boolean }) {
  const t = useExtracted();

  if (saving) {
    return <PendingMainAction>{t("Done")}</PendingMainAction>;
  }

  return <EnterLink href={href}>{t("Done")}</EnterLink>;
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
    <TaskAsideContent
      className={cn("with-aside:top-0 with-aside:group-data-aside/task:pt-0", className)}
    >
      <section aria-labelledby="explain-recap" className="with-aside:gap-0 flex flex-col gap-1">
        <h2
          className={cn(
            PAGE_SECTION_TITLE_CLASS,
            "with-aside:text-label with-aside:flex with-aside:h-13 with-aside:shrink-0 with-aside:items-center with-aside:xl:h-15",
          )}
          id="explain-recap"
        >
          {t("In {count, plural, one {# sentence} other {# sentences}}", { count: recap.length })}
        </h2>
        <ol className="flex flex-col [&>li+li]:border-t">
          {recap.map((sentence, index) => (
            <li className="with-aside:first:pt-0 flex items-baseline gap-3 py-3" key={sentence}>
              <span
                aria-hidden="true"
                className="text-faint w-4 shrink-0 font-mono text-xs tabular-nums"
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

        <ExplainRecap className={cn(saving && "without-aside:hidden")} recap={explanation.recap} />

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
