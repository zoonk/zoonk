"use client";

import { type EssayDraft } from "@zoonk/core/exams/essays/contract";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { CheckIcon, CircleIcon, LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Meter, MeterFill } from "../_components/meter";
import { useEssayScreen } from "./essay-context";
import { formatScore, useCriterionName, useInterventionElementName } from "./essay-labels";

type Grade = EssayDraft["grade"];

const ELEMENTS = ["agent", "action", "means", "effect", "detail"] as const;

function ScoreHeader({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const isFreeResponse = useEssayScreen().essay.rubric === "ap";

  return (
    <div className="flex items-end justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="in-data-[mode=fun]:font-fun-display text-2xl font-bold">
          {isFreeResponse ? t("Your answer") : t("Your essay")}
        </h2>
        <p className="text-muted-foreground text-sm">
          {isFreeResponse
            ? t("Scored like the AP scoring guidelines, out of {max, number} points", {
                max: grade.total.maxScore,
              })
            : t("Graded by the official rubric")}
        </p>
      </div>
      <div className="flex flex-col items-end">
        <p className="in-data-[mode=fun]:font-fun-display text-2xl font-bold whitespace-nowrap tabular-nums sm:text-3xl">
          {t("{low}–{high}", {
            high: formatScore(grade.range.high),
            low: formatScore(grade.range.low),
          })}
        </p>
        <p className="text-muted-foreground text-xs">{t("Estimated")}</p>
      </div>
    </div>
  );
}

function CriteriaTable({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();

  return (
    <ul
      aria-label={t("Score by criterion")}
      className="border-border in-data-[mode=fun]:fun-glass flex flex-col gap-2 rounded-3xl border p-4 in-data-[mode=fun]:border-transparent"
    >
      {grade.criteria.map((criterion) => {
        const isNext = criterion.id === grade.nextStep.criterionId;
        const share = criterion.maxScore > 0 ? criterion.score / criterion.maxScore : 0;

        return (
          <li
            className={cn(
              "flex items-start gap-3 rounded-xl px-2 py-1.5 text-sm",
              isNext && "bg-warning/10 in-data-[mode=fun]:bg-fun-accent-amber/15",
            )}
            key={criterion.id}
          >
            <span className="min-w-0 flex-1">{criterionName(criterion)}</span>
            {/* The bar and score stay on the name's first line when a long name wraps. */}
            <LineMarker>
              <Meter className="w-20">
                <MeterFill
                  className={isNext ? "bg-warning" : "in-data-[mode=fun]:bg-fun-accent-violet"}
                  share={share}
                />
              </Meter>
            </LineMarker>
            <span className="w-12 shrink-0 text-right font-medium tabular-nums">
              {formatScore(criterion.score)}
            </span>
          </li>
        );
      })}
      <li className="text-muted-foreground px-2 pt-1 text-right text-xs">
        {t("Total {score} of {max}", {
          max: formatScore(grade.total.maxScore),
          score: formatScore(grade.total.score),
        })}
      </li>
    </ul>
  );
}

function InterventionElements({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const elementName = useInterventionElementName();
  const elements = grade.enemInterventionElements;

  if (!elements) {
    return null;
  }

  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold">{t("The five elements of the proposal")}</h3>
      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ELEMENTS.map((key) => (
          <li className="flex items-start gap-2 text-sm" key={key}>
            <LineMarker aria-hidden="true">
              {elements[key] ? (
                <CheckIcon className="text-success size-4" />
              ) : (
                <CircleIcon className="text-muted-foreground size-4" />
              )}
            </LineMarker>
            <span className={cn(!elements[key] && "text-muted-foreground")}>
              {elementName(key)}
              <span className="sr-only">{elements[key] ? t(", present") : t(", missing")}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The one next step, on the criterion that would gain the most, with the learner's own words. */
function NextStep({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const criterion = grade.criteria.find((item) => item.id === grade.nextStep.criterionId);

  if (grade.zeroReason === "tooShort") {
    return (
      <p className="bg-muted/60 in-data-[mode=fun]:fun-glass rounded-2xl p-4 text-sm">
        {t("This is too short to grade. Write the whole essay, then send it again.")}
      </p>
    );
  }

  return (
    <section className="bg-muted/60 in-data-[mode=fun]:fun-paper flex flex-col gap-2 rounded-2xl p-4">
      <p className="flex items-start gap-2 text-sm font-semibold">
        <LineMarker aria-hidden="true">
          <LightbulbIcon className="text-warning size-4" />
        </LineMarker>
        {criterion
          ? t("Next step: {criterion}", { criterion: criterionName(criterion) })
          : t("Next step")}
      </p>
      {criterion?.quote && (
        <blockquote className="border-warning border-l-2 pl-3 font-serif text-sm italic">
          {criterion.quote}
        </blockquote>
      )}
      <p className="text-sm">{grade.nextStep.text}</p>
      {criterion?.example && (
        <p className="text-muted-foreground text-sm">
          {t("For example: {example}", { example: criterion.example })}
        </p>
      )}
    </section>
  );
}

function CriterionComments({ grade }: { grade: Grade }) {
  const t = useExtracted();
  const criterionName = useCriterionName();

  return (
    <details className="flex flex-col gap-2">
      <summary className="text-muted-foreground cursor-pointer py-3 text-sm font-medium">
        {t("See comments on every criterion")}
      </summary>
      <ul className="mt-3 flex flex-col gap-3">
        {grade.criteria.map((criterion) => (
          <li className="flex flex-col gap-1 text-sm" key={criterion.id}>
            <p className="font-medium">{criterionName(criterion)}</p>
            {criterion.quote && (
              <blockquote className="text-muted-foreground border-l-2 pl-3 italic">
                {criterion.quote}
              </blockquote>
            )}
            <p>{criterion.comment}</p>
          </li>
        ))}
      </ul>
    </details>
  );
}

/** A graded draft: the estimated range, each criterion, the five elements and one next step. */
export function EssayFeedback() {
  const { drafts } = useEssayScreen();
  const grade = drafts[0]?.grade;

  if (!grade) {
    return null;
  }

  return (
    <div aria-live="polite" className="flex flex-col gap-5" data-slot="essay-feedback">
      <ScoreHeader grade={grade} />
      <CriteriaTable grade={grade} />
      <NextStep grade={grade} />
      <InterventionElements grade={grade} />
      <CriterionComments grade={grade} />
    </div>
  );
}
