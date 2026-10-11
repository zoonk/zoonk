"use client";

import { type LanguageConversationView } from "@zoonk/core/language/conversations/contract";
import {
  type ExamSpeakingFeedback,
  type ExamTaskView,
  type SpeakingCriterionView,
} from "@zoonk/core/language/exam-speaking/contract";
import { Badge } from "@zoonk/ui/components/badge";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { InfoIcon, LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { useTransition } from "react";
import { Callout } from "../../_components/callout";
import { KindTile } from "../../_components/kind-tile";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
} from "../../_components/step-card";
import { Steps, type StepsItem } from "../../_components/steps";
import { TaskMainLink } from "../../shell/task-frame";
import { CriteriaDetails } from "./exam-speaking-criteria";
import { useBandText, useCriterionGloss, useStandingText } from "./exam-speaking-labels";
import { useExamTaskTitle } from "./exam-task-intro";

type Grade = ExamSpeakingFeedback["criteria"][number];
type GradedCriterion = { criterion: SpeakingCriterionView; grade: Grade };

/** The task's criteria in the order its paper lists them, each with its estimate, if it has one. */
function listCriteria({
  examTask,
  feedback,
}: {
  examTask: ExamTaskView;
  feedback: ExamSpeakingFeedback;
}): { criterion: SpeakingCriterionView; grade: Grade | null }[] {
  return examTask.criteria.map((criterion) => ({
    criterion,
    grade: feedback.criteria.find((item) => item.criterion === criterion.key) ?? null,
  }));
}

function isGraded(item: { grade: Grade | null }): item is GradedCriterion {
  return item.grade !== null;
}

function CriterionName({
  criterion,
  language,
}: {
  criterion: SpeakingCriterionView;
  language: string;
}) {
  const gloss = useCriterionGloss();

  return (
    <span className="flex min-w-0 flex-col">
      <span className="font-medium">{gloss(criterion)}</span>
      <span className="text-muted-foreground text-xs" lang={language}>
        {criterion.name}
      </span>
    </span>
  );
}

/**
 * The band every numbered scale of the task names for the exam's level ("On these scales, 2 is
 * the B2 level"), so "1–2 of 3" reads against it; null for letters and points, or mixed levels.
 */
function useLevelLine({ examTask }: { examTask: ExamTaskView }): string | null {
  const t = useExtracted();
  const bands = new Set(examTask.criteria.map((criterion) => criterion.levelBand));
  const [band] = bands;
  const numbered = examTask.criteria.every((criterion) => criterion.display === "band");

  if (!numbered || bands.size !== 1 || band === null || band === undefined) {
    return null;
  }

  return t("On these scales, {band} is the {level} level.", {
    band: String(band),
    level: examTask.level,
  });
}

/**
 * What the estimate rests on, said once above the criteria: typed replies leave out how the
 * learner sounds, and a brief task leaves little to judge.
 */
function useEvidenceNotes({ feedback }: { feedback: ExamSpeakingFeedback }): string[] {
  const t = useExtracted();

  return [
    !feedback.heard && t("You typed your replies, so this estimate leaves out how you sound."),
    feedback.brief &&
      t(
        "You said little in this task, so there wasn't much to judge. A longer try gives a closer estimate.",
      ),
  ].filter((note) => typeof note === "string");
}

/** One criterion's estimate and where it stands against the exam's level; the focus marked. */
function CriterionEstimate({
  focus,
  graded,
  level,
}: {
  focus: boolean;
  graded: GradedCriterion;
  level: string;
}) {
  const t = useExtracted();
  const band = useBandText();
  const standingText = useStandingText();
  const { standing, text } = standingText(graded.grade, graded.criterion, level);

  return (
    <span className="flex shrink-0 flex-col items-end gap-1">
      <span className="font-semibold whitespace-nowrap tabular-nums">
        {band(graded.grade, graded.criterion)}
      </span>
      <span className={cn("text-xs", standing === "at" ? "text-success" : "text-muted-foreground")}>
        {text}
      </span>
      {focus && <Badge variant="outline">{t("Focus")}</Badge>}
    </span>
  );
}

/**
 * Each criterion's estimate on its official scale and where it stands against the exam's level,
 * and the ones typed replies can't show left unrated.
 */
function CriteriaStep({
  conversation,
  examTask,
  feedback,
}: {
  conversation: LanguageConversationView;
  examTask: ExamTaskView;
  feedback: ExamSpeakingFeedback;
}) {
  const t = useExtracted();
  const title = useExamTaskTitle();
  const levelLine = useLevelLine({ examTask });
  const notes = useEvidenceNotes({ feedback });
  const aboutSound = feedback.heard && examTask.criteria.some((criterion) => criterion.sound);

  return (
    <>
      <StepCard>
        <KindTile kind="conversation" size="lg" />
        <StepHeader>
          <StepEyebrow>{title(examTask)}</StepEyebrow>
          <StepTitle lang={conversation.targetLanguage}>{examTask.task.name}</StepTitle>
          {levelLine && <StepDetail>{levelLine}</StepDetail>}
          {notes.map((note) => (
            <StepDetail key={note}>{note}</StepDetail>
          ))}
        </StepHeader>
        <StepRows>
          {listCriteria({ examTask, feedback }).map((item) => (
            <StepRow className="items-start justify-between gap-3" key={item.criterion.key}>
              <CriterionName criterion={item.criterion} language={conversation.targetLanguage} />
              {isGraded(item) ? (
                <CriterionEstimate
                  focus={item.criterion.key === feedback.focus}
                  graded={item}
                  level={examTask.level}
                />
              ) : (
                <span className="text-muted-foreground shrink-0 text-sm">{t("Not rated")}</span>
              )}
            </StepRow>
          ))}
        </StepRows>
      </StepCard>

      <Callout>
        <InfoIcon aria-hidden="true" />
        <p>
          {aboutSound
            ? t(
                "An estimate from one practice task, not an official score. How you sound is rated by how easy you are to understand, never by your accent.",
              )
            : t("An estimate from one practice task, not an official score.")}
        </p>
      </Callout>
    </>
  );
}

/** The criterion to work on first: what was heard, and one concrete tip. */
function FocusStep({ focus, language }: { focus: GradedCriterion; language: string }) {
  const t = useExtracted();
  const gloss = useCriterionGloss();

  return (
    <>
      <StepCard>
        <StepHeader>
          <StepEyebrow>{t("Work on this first")}</StepEyebrow>
          <StepTitle>{gloss(focus.criterion)}</StepTitle>
          <StepDetail lang={language}>{focus.criterion.name}</StepDetail>
          <StepDetail>{focus.grade.evidence}</StepDetail>
        </StepHeader>
      </StepCard>

      <Callout>
        <LightbulbIcon aria-hidden="true" />
        <p>{focus.grade.tip}</p>
      </Callout>
    </>
  );
}

/** Nothing to grade, never the learner's fault. */
function NoGradeStep() {
  const t = useExtracted();

  return (
    <StepCard>
      <KindTile kind="conversation" size="lg" />
      <StepTitle>{t("This task has no estimate")}</StepTitle>
      <StepDetail>{t("Try the task again when you're ready.")}</StepDetail>
    </StepCard>
  );
}

function TryAgainButton({ onTryAgain }: { onTryAgain: () => Promise<void> }) {
  const t = useExtracted();
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      className="w-full"
      disabled={isPending}
      onClick={() => startTransition(onTryAgain)}
      size="lg"
      variant="ghost"
    >
      {t("Try this task with a new card")}
    </Button>
  );
}

/**
 * After an exam's speaking task, one thing at a time: each official criterion the task is rated on
 * with its estimate on the exam's own scale (DELE's 0 to 3, Goethe's A to E, Cambridge's 0 to 5 in
 * half bands, DELF's points) and the ones at the exam's level marked, then the one to work on
 * first with what was heard and a tip. One task gives no total: the paper's points come from all
 * its tasks. It's an estimate, never an official score, and pronunciation counts how easy the
 * learner is to understand, never their accent.
 */
export function ExamSpeakingResult({
  conversation,
  examTask,
  exitHref,
  feedback,
  nextHref,
  nextTaskHref,
  onTryAgain,
}: {
  conversation: LanguageConversationView;
  examTask: ExamTaskView;
  exitHref: string;
  feedback: ExamSpeakingFeedback | null;
  nextHref: string;
  /** The paper's next task, opened in its list; null after the last one. */
  nextTaskHref: string | null;
  onTryAgain: (() => Promise<void>) | null;
}) {
  const t = useExtracted();
  const language = conversation.targetLanguage;
  const criteria = feedback ? listCriteria({ examTask, feedback }) : [];
  const graded = criteria.filter((item) => isGraded(item));
  const focus = graded.find(({ criterion }) => criterion.key === feedback?.focus);

  const items: StepsItem[] =
    feedback && graded.length > 0
      ? [
          {
            content: (
              <CriteriaStep conversation={conversation} examTask={examTask} feedback={feedback} />
            ),
            id: "criteria",
          },
          focus && { content: <FocusStep focus={focus} language={language} />, id: "focus" },
        ].filter((item) => item !== undefined)
      : [{ content: <NoGradeStep />, id: "noGrade" }];

  return (
    <Steps
      exitHref={exitHref}
      finalAction={
        nextTaskHref ? (
          <TaskMainLink href={nextTaskHref}>
            {t("Go to task {number}", { number: String(examTask.number + 1) })}
          </TaskMainLink>
        ) : (
          <TaskMainLink href={nextHref}>{t("Continue")}</TaskMainLink>
        )
      }
      finalOptions={
        <>
          {onTryAgain && <TryAgainButton onTryAgain={onTryAgain} />}
          {graded.length > 0 && (
            <CriteriaDetails graded={graded} language={language} level={examTask.level} />
          )}
        </>
      }
      items={items}
    />
  );
}
