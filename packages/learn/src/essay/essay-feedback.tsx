"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { DetailsDrawer } from "../_components/details-drawer";
import { Meter, MeterFill } from "../_components/meter";
import { PageSectionTitle } from "../_components/page";
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

function hasMissingElements(grade: Grade): boolean {
  const elements = grade.enemInterventionElements;
  return elements !== null && ELEMENTS.some((key) => !elements[key]);
}

type Criterion = Grade["criteria"][number];

function renderNumber(chunks: React.ReactNode) {
  return <span className="tabular-nums">{chunks}</span>;
}

/** A custom rubric's criteria each show on the total's scale, so three read "10 of 10", never "3.34 · 3.33 · 3.33". */
function toShownScore({
  criterion,
  rubric,
  total,
}: {
  criterion: Criterion;
  rubric: string;
  total: Grade["total"];
}): { max: number; score: number } {
  if (rubric !== "custom" || criterion.maxScore <= 0) {
    return { max: criterion.maxScore, score: criterion.score };
  }

  return { max: total.maxScore, score: (criterion.score / criterion.maxScore) * total.maxScore };
}

export function CriteriaRows({ grade, rubric }: { grade: Grade; rubric: string }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const formatScore = useFormatScore();

  return (
    <StepRows aria-label={t("Score by criterion")}>
      {grade.criteria.map((criterion) => {
        const isNext = criterion.id === grade.nextStep?.criterionId;
        const share = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0;
        const shown = toShownScore({ criterion, rubric, total: grade.total });

        return (
          <StepRow key={criterion.id}>
            <span className={cn("min-w-0 flex-1", isNext && "font-semibold")}>
              {criterionName(criterion)}
            </span>
            <Meter className="w-16 shrink-0 sm:w-20">
              <MeterFill className={isNext ? "bg-warning" : undefined} share={share} />
            </Meter>
            <span className="shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums">
              {t("{score} of {max}", {
                max: formatScore(shown.max),
                score: formatScore(shown.score),
              })}
            </span>
          </StepRow>
        );
      })}
    </StepRows>
  );
}

export function EssayGradeCard({ grade, rubric }: { grade: Grade; rubric: string }) {
  const t = useExtracted();
  const formatScore = useFormatScore();
  const writingName = useWritingName();

  if (grade.zeroReason === "tooShort") {
    return (
      <StepCard>
        <StepHeader>
          <StepTitle>{t("Too short to grade")}</StepTitle>
          <StepDetail>{t("Write the whole essay, then send it again.")}</StepDetail>
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
            mono: renderNumber,
          })}
        </StepDetail>
      </StepHeader>
      <CriteriaRows grade={grade} rubric={rubric} />
    </StepCard>
  );
}

function GradeStep({ grade }: { grade: Grade }) {
  const { rubric } = useEssayScreen().essay;
  return <EssayGradeCard grade={grade} rubric={rubric} />;
}

function NothingLeftComment() {
  const t = useExtracted();

  return (
    <StepCard>
      <StepHeader>
        <StepEyebrow>{t("Next step")}</StepEyebrow>
        <StepTitle>{t("Nothing left to work on")}</StepTitle>
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
        <StepEyebrow>{t("Next step")}</StepEyebrow>
        <StepTitle>{criterion ? criterionName(criterion) : t("What to rewrite")}</StepTitle>
      </StepHeader>

      {criterion?.quote && (
        <blockquote className="border-warning border-l-2 pl-3 italic">{criterion.quote}</blockquote>
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
            <blockquote className="text-muted-foreground border-border border-l-2 pl-3 italic">
              {criterion.quote}
            </blockquote>
          )}
          <p className="text-pretty">{criterion.comment}</p>
        </li>
      ))}
    </ul>
  );
}

export function EssayGradeSteps({ grade, onRewrite }: { grade: Grade; onRewrite: () => void }) {
  const t = useExtracted();
  const { hrefs } = useEssayScreen();
  const finishing = useFinishEssay();
  const tooShort = grade.zeroReason === "tooShort";

  const skip = (
    <Button
      className="shrink-0"
      disabled={finishing.pending}
      onClick={() => void finishing.finish()}
      size="xl"
      variant="outline"
    >
      {t("Skip the rewrite")}
    </Button>
  );

  const items: StepsItem[] = tooShort
    ? [{ action: skip, content: <GradeStep grade={grade} />, id: "grade" }]
    : [
        { content: <GradeStep grade={grade} />, id: "grade" },
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
      finalAction={<TaskMainButton onClick={onRewrite}>{t("Rewrite")}</TaskMainButton>}
      finalOptions={
        <>
          {finishing.failed && (
            <p className="text-destructive-text text-sm" role="alert">
              {t("That didn't go through. Try again in a moment.")}
            </p>
          )}
          {!tooShort && (
            <div className="flex flex-col lg:hidden">
              <DetailsDrawer label={t("See comments on every criterion")} title={t("Comments")}>
                <CriterionComments grade={grade} />
              </DetailsDrawer>
            </div>
          )}
        </>
      }
      items={items}
    />
  );
}
