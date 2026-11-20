"use client";

import { Button } from "@zoonk/ui/components/button";
import { cn } from "@zoonk/ui/lib/utils";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import { PageSectionTitle } from "../_components/page";
import { useEssayScreen } from "./essay-context";
import { CriteriaRows } from "./essay-criteria-rows";
import { useCriterionName } from "./essay-labels";
import { rewriteStep } from "./essay-rewrite-step";

/** `headed` when the aside's own header already names the grade. */
export function CriteriaInView({ headed = false }: { headed?: boolean }) {
  const t = useExtracted();
  const { drafts, essay } = useEssayScreen();
  const grade = drafts[0]?.grade;

  if (!grade || grade.zeroReason === "tooShort") {
    return null;
  }

  return (
    <section className="hidden flex-col gap-1 lg:flex">
      <PageSectionTitle className={cn(headed && "with-aside:group-data-aside/task:sr-only")}>
        {t({
          description: "The grade of the learner's last essay draft.",
          message: "Your last grade",
        })}
      </PageSectionTitle>
      <CriteriaRows grade={grade} meter={false} rubric={essay.rubric} />
    </section>
  );
}

export function RewriteGuide({ onSeeGrade }: { onSeeGrade: () => void }) {
  const t = useExtracted();
  const criterionName = useCriterionName();
  const { drafts } = useEssayScreen();
  const grade = drafts[0]?.grade;

  if (!grade) {
    return null;
  }

  const step = rewriteStep(grade);

  return (
    <Callout>
      <LightbulbIcon aria-hidden="true" />
      <div className="flex flex-col gap-1">
        {step.kind === "tooShort" && (
          <p>
            <span className="font-semibold">{t("Too short to grade")} </span>
            {t("Write the whole essay, then send it again.")}
          </p>
        )}
        {step.kind === "nextStep" && (
          <p>
            {step.criterion && (
              <span className="font-semibold">
                {t("Next step: {criterion}", { criterion: criterionName(step.criterion) })}{" "}
              </span>
            )}
            {step.text}
          </p>
        )}
        {step.kind === "fullMarks" && (
          <p>{t("Every criterion has full marks in this estimate.")}</p>
        )}
        <Button
          className="text-foreground mt-1 self-start"
          onClick={onSeeGrade}
          size="sm"
          variant="outline"
        >
          {t("See the grade")}
        </Button>
      </div>
    </Callout>
  );
}
