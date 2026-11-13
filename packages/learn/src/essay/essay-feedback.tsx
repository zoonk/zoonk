"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { BACK_ICON, Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleIcon, SkipForwardIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { PageSectionTitle } from "../_components/page";
import {
  StepCard,
  StepDetail,
  StepHeader,
  StepRow,
  StepRows,
  StepTitle,
  StepTitleLabel,
  StepTitleNumber,
  renderStepNumber,
} from "../_components/step-card";
import { Steps, type StepsItem } from "../_components/steps";
import { TaskMainButton, TaskMainLink } from "../shell/task-frame";
import { useEssayScreen } from "./essay-context";
import { CriteriaRows } from "./essay-criteria-rows";
import {
  ESSAY_QUOTE_CLASS,
  useCriterionName,
  useFormatScore,
  useInterventionElementName,
  useWritingName,
} from "./essay-labels";
import { useFinishEssay } from "./use-finish-essay";

type Grade = EssayDraft["grade"];

const ELEMENTS = ["agent", "action", "means", "effect", "detail"] as const;

function hasMissingElements(grade: Grade): boolean {
  const elements = grade.enemInterventionElements;
  return elements !== null && ELEMENTS.some((key) => !elements[key]);
}

export function EssayGradeCard({
  children,
  closed,
  grade,
  rubric,
}: {
  children?: React.ReactNode;
  closed?: boolean;
  grade: Grade;
  rubric: string;
}) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const writingName = useWritingName();

  if (grade.zeroReason === "tooShort") {
    return (
      <StepCard>
        <StepHeader>
          <StepTitle>{t("Too short to grade")}</StepTitle>
          {!closed && <StepDetail>{t("Write the whole essay, then send it again.")}</StepDetail>}
        </StepHeader>
      </StepCard>
    );
  }

  return (
    <StepCard>
      <StepHeader>
        <StepTitle className="flex flex-col items-start gap-1.5">
          <StepTitleLabel>{writingName(rubric)}</StepTitleLabel>
          <StepTitleNumber>
            {t("{low}–{high}", {
              high: formatScore(grade.range.high),
              low: formatScore(grade.range.low),
            })}
          </StepTitleNumber>
        </StepTitle>
        <StepDetail className="text-sm">
          {t.rich("Estimated score, from <mono>0</mono> to <mono>{max}</mono>", {
            max: formatScore(grade.total.maxScore),
            mono: renderStepNumber,
          })}
        </StepDetail>
      </StepHeader>
      <CriteriaRows grade={grade} rubric={rubric} />
      {children}
    </StepCard>
  );
}

/** Beside the grade from the width that shows the aside, so the button is the narrower screens'. */
function GradeStep({ closed, grade }: { closed: boolean; grade: Grade }) {
  const t = useExtracted();
  const { rubric } = useEssayScreen().essay;

  return (
    <EssayGradeCard closed={closed} grade={grade} rubric={rubric}>
      <div className="with-aside:hidden flex">
        <DetailsDrawer label={t("See comments")} title={t("Comments")} trigger="small">
          <CriterionComments grade={grade} />
        </DetailsDrawer>
      </div>
    </EssayGradeCard>
  );
}

function NothingLeftComment() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <StepTitle className="flex flex-col items-start gap-1.5">
          <StepTitleLabel>{t("Next step")}</StepTitleLabel>
          {t("Nothing left to work on")}
        </StepTitle>
        <StepDetail>{t("Every criterion has full marks in this estimate.")}</StepDetail>
      </StepHeader>
    </StepCard>
  );
}

export function NextStepComment({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const { nextStep } = grade;

  if (!nextStep) {
    return <NothingLeftComment />;
  }

  const criterion = grade.criteria.find((item) => item.id === nextStep.criterionId);

  return (
    <StepCard className="items-stretch">
      <StepHeader>
        <StepTitle className="flex flex-col items-start gap-1.5">
          <StepTitleLabel>{t("Next step")}</StepTitleLabel>
          {criterion ? criterionName(criterion) : t("What to rewrite")}
        </StepTitle>
      </StepHeader>

      {criterion?.quote && (
        <blockquote className={cn(ESSAY_QUOTE_CLASS, "border-warning italic")}>
          {criterion.quote}
        </blockquote>
      )}
      <p>{nextStep.text}</p>
      {criterion?.example && (
        <p className="text-muted-foreground text-sm">
          {t("For example: {example}", { example: criterion.example })}
        </p>
      )}
    </StepCard>
  );
}

function ProposalElements({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const elementName = useInterventionElementName();
  const elements = grade.enemInterventionElements;

  if (!elements || !hasMissingElements(grade)) {
    return null;
  }

  return (
    <section className="flex w-full flex-col gap-1">
      <PageSectionTitle>{t("The five elements of the proposal")}</PageSectionTitle>
      <StepRows>
        {ELEMENTS.map((key) => (
          <StepRow key={key}>
            {elements[key] ? (
              <CheckIcon aria-hidden="true" className="text-success-text" />
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
    </section>
  );
}

function NextStep({ grade }: { grade: Grade }) {
  return (
    <>
      <NextStepComment grade={grade} />
      <ProposalElements grade={grade} />
    </>
  );
}

function CriterionComments({ grade }: { grade: Grade }) {
  const criterionName = useCriterionName();

  return (
    <ul className="flex flex-col gap-4">
      {grade.criteria.map((criterion) => (
        <li className="flex flex-col gap-1 text-sm" key={criterion.id}>
          <p className="font-semibold">{criterionName(criterion)}</p>
          {criterion.quote && (
            <blockquote
              className={cn(ESSAY_QUOTE_CLASS, "text-muted-foreground border-border italic")}
            >
              {criterion.quote}
            </blockquote>
          )}
          <p className="text-pretty">{criterion.comment}</p>
        </li>
      ))}
    </ul>
  );
}

/** Without `onRewrite` the essay is closed: its grade shows read-only, with only the way back. */
export function EssayGradeSteps({ grade, onRewrite }: { grade: Grade; onRewrite?: () => void }) {
  const t = useExtracted();
  const { hrefs } = useEssayScreen();
  const finishing = useFinishEssay();
  const tooShort = grade.zeroReason === "tooShort";
  const closed = !onRewrite;

  const skip = onRewrite && (
    <>
      {finishing.failures > 0 && (
        <p
          className="text-destructive-text order-first basis-full text-sm lg:text-right"
          role="alert"
        >
          {t("That didn't go through. Try again in a moment.")}
        </p>
      )}
      <Button
        busy={finishing.pending}
        className="shrink-0"
        icon={<SkipForwardIcon aria-hidden="true" />}
        onClick={() => void finishing.finish()}
        size="xl"
        variant="outline"
      >
        {t("Skip")}
      </Button>
    </>
  );

  const items: StepsItem[] = tooShort
    ? [{ action: skip, content: <GradeStep closed={closed} grade={grade} />, id: "grade" }]
    : [
        { content: <GradeStep closed={closed} grade={grade} />, id: "grade" },
        { action: skip, content: <NextStep grade={grade} />, id: "nextStep" },
      ];

  return (
    <Steps
      aside={
        tooShort
          ? null
          : {
              children: <CriterionComments grade={grade} />,
              label: t("Comments"),
              title: t("Comments"),
            }
      }
      exitHref={hrefs.exit}
      finalAction={
        onRewrite ? (
          <TaskMainButton onClick={onRewrite}>{t("Rewrite")}</TaskMainButton>
        ) : (
          <TaskMainLink href={hrefs.exit} {...BACK_ICON}>
            {t("Back to Today")}
          </TaskMainLink>
        )
      }
      items={items}
    />
  );
}
