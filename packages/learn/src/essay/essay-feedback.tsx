"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleIcon, LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { KindTile } from "../_components/kind-tile";
import { Meter, MeterFill } from "../_components/meter";
import {
  StepCard,
  StepDetail,
  StepEyebrow,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
} from "../_components/step-card";
import { Steps, type StepsItem } from "../_components/steps";
import { TaskMainButton } from "../shell/task-frame";
import { useEssayScreen } from "./essay-context";
import {
  useCriterionName,
  useFormatScore,
  useInterventionElementName,
  useWritingName,
} from "./essay-labels";
import { useFinishEssay } from "./use-finish-essay";

type Grade = EssayDraft["grade"];

const ELEMENTS = ["agent", "action", "means", "effect", "detail"] as const;

/** Whether a proposal is missing any of ENEM's five elements; null outside ENEM. */
function hasMissingElements(grade: Grade): boolean {
  const elements = grade.enemInterventionElements;
  return elements !== null && ELEMENTS.some((key) => !elements[key]);
}

function CriteriaRows({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const formatScore = useFormatScore();

  return (
    <StepRows aria-label={t("Score by criterion")}>
      {grade.criteria.map((criterion) => {
        const isNext = criterion.id === grade.nextStep.criterionId;
        const share = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0;

        return (
          <StepRow key={criterion.id}>
            <span className={cn("min-w-0 flex-1", isNext && "font-semibold")}>
              {criterionName(criterion)}
            </span>
            <Meter className="w-16 shrink-0 sm:w-20">
              <MeterFill className={isNext ? "bg-warning" : undefined} share={share} />
            </Meter>
            <span className="w-10 shrink-0 text-right font-medium tabular-nums">
              {formatScore(criterion.score)}
            </span>
          </StepRow>
        );
      })}
    </StepRows>
  );
}

/** The estimated range, big, and each criterion's score; the one to work on next stands out. */
function GradeStep({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const { rubric } = useEssayScreen().essay;
  const formatScore = useFormatScore();
  const writingName = useWritingName();

  if (grade.zeroReason === "tooShort") {
    return (
      <StepCard>
        <KindTile kind="essay" size="lg" />
        <StepHeader>
          <StepTitle>{t("Too short to grade")}</StepTitle>
          <StepDetail>{t("Write the whole essay, then send it again.")}</StepDetail>
        </StepHeader>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <KindTile kind="essay" size="lg" />
      <StepHeader>
        <StepTitle className="flex flex-col items-center gap-1.5">
          <StepTitleLabel>{writingName(rubric)}</StepTitleLabel>
          <StepTitleNumber>
            {t("{low}–{high}", {
              high: formatScore(grade.range.high),
              low: formatScore(grade.range.low),
            })}
          </StepTitleNumber>
        </StepTitle>
        <StepDetail>{t("Estimated")}</StepDetail>
      </StepHeader>
      <CriteriaRows grade={grade} />
    </StepCard>
  );
}

/** The one next step, on the criterion that would gain the most, with the learner's own words. */
function NextStepComment({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const criterion = grade.criteria.find((item) => item.id === grade.nextStep.criterionId);

  return (
    <StepCard className="items-stretch text-left">
      <KindTile className="self-center" icon={LightbulbIcon} kind="essay" size="lg" />
      <StepHeader>
        <StepEyebrow>{t("Next step")}</StepEyebrow>
        <StepTitle className="text-center">
          {criterion ? criterionName(criterion) : t("What to rewrite")}
        </StepTitle>
      </StepHeader>

      {criterion?.quote && (
        <blockquote className="border-warning border-l-2 pl-3 font-serif italic">
          {criterion.quote}
        </blockquote>
      )}
      <p>{grade.nextStep.text}</p>
      {criterion?.example && (
        <p className="text-muted-foreground text-sm">
          {t("For example: {example}", { example: criterion.example })}
        </p>
      )}
    </StepCard>
  );
}

/** ENEM's five elements of an intervention proposal, when the proposal misses any. */
function InterventionElements({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const elementName = useInterventionElementName();
  const elements = grade.enemInterventionElements;

  if (!elements) {
    return null;
  }

  return (
    <StepCard>
      <StepTitle>{t("The five elements of the proposal")}</StepTitle>
      <StepRows>
        {ELEMENTS.map((key) => (
          <StepRow key={key}>
            {elements[key] ? (
              <CheckIcon aria-hidden="true" className="text-success" />
            ) : (
              <CircleIcon aria-hidden="true" className="text-muted-foreground" />
            )}
            <span className={cn(!elements[key] && "text-muted-foreground")}>
              {elementName(key)}
              <span className="sr-only">{elements[key] ? t(", present") : t(", missing")}</span>
            </span>
          </StepRow>
        ))}
      </StepRows>
    </StepCard>
  );
}

/** Every criterion's comment, with the passage it's about, one text link away. */
function CriterionComments({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();

  return (
    <DetailsDrawer label={t("See comments on every criterion")} title={t("Comments")}>
      <ul className="flex flex-col gap-4">
        {grade.criteria.map((criterion) => (
          <li className="flex flex-col gap-1 text-sm" key={criterion.id}>
            <p className="font-semibold">{criterionName(criterion)}</p>
            {criterion.quote && (
              <blockquote className="text-muted-foreground border-l-2 pl-3 italic">
                {criterion.quote}
              </blockquote>
            )}
            <p>{criterion.comment}</p>
          </li>
        ))}
      </ul>
    </DetailsDrawer>
  );
}

/** Once graded, going on without rewriting stays one quiet tap away. */
export function FinishEssayButton({ variant = "ghost" }: { variant?: "ghost" | "outline" }) {
  const t = useExtracted();
  const { failed, finish, pending } = useFinishEssay();

  return (
    <>
      {failed && (
        <p className="text-destructive text-center text-sm" role="alert">
          {t("That didn't go through. Try again in a moment.")}
        </p>
      )}
      <Button
        className="w-full"
        disabled={pending}
        onClick={() => void finish()}
        size="lg"
        variant={variant}
      >
        {t("Continue")}
      </Button>
    </>
  );
}

/**
 * A graded draft, one thing at a time: the estimated range with each criterion, the one next step
 * with the learner's own words, and ENEM's five proposal elements when any is missing. Rewriting
 * is then the main action; every criterion's comment waits behind a link.
 */
export function EssayGradeSteps({ grade, onRewrite }: { grade: Grade; onRewrite: () => void }) {
  const t = useExtracted();
  const { hrefs } = useEssayScreen();
  const tooShort = grade.zeroReason === "tooShort";

  const items: StepsItem[] = [
    { content: <GradeStep grade={grade} />, id: "grade" },
    !tooShort && { content: <NextStepComment grade={grade} />, id: "nextStep" },
    !tooShort &&
      hasMissingElements(grade) && {
        content: <InterventionElements grade={grade} />,
        id: "elements",
      },
  ].filter((item) => item !== false);

  return (
    <Steps
      exitHref={hrefs.exit}
      finalAction={<TaskMainButton onClick={onRewrite}>{t("Rewrite")}</TaskMainButton>}
      finalOptions={
        <>
          <FinishEssayButton />
          {!tooShort && <CriterionComments grade={grade} />}
        </>
      }
      items={items}
    />
  );
}
