"use client";

import { Button } from "@zoonk/ui/components/button";
import { LightbulbIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Callout } from "../_components/callout";
import { PageSectionTitle } from "../_components/page";
import { useEssayScreen } from "./essay-context";
import { CriteriaRows } from "./essay-feedback";
import { useCriterionName } from "./essay-labels";

export function CriteriaInView() {
  const t = useExtracted();
  const { drafts, essay } = useEssayScreen();
  const grade = drafts[0]?.grade;

  if (!grade || grade.zeroReason === "tooShort") {
    return null;
  }

  return (
    <section className="hidden flex-col gap-1 lg:flex">
      <PageSectionTitle>{t("Your last grade")}</PageSectionTitle>
      <CriteriaRows grade={grade} rubric={essay.rubric} />
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

  const { nextStep } = grade;
  const criterion = grade.criteria.find((item) => item.id === nextStep?.criterionId);

  return (
    <Callout>
      <LightbulbIcon aria-hidden="true" />
      <div className="flex flex-col gap-1">
        <p>
          {criterion && (
            <span className="font-semibold">
              {t("Next step: {criterion}", { criterion: criterionName(criterion) })}{" "}
            </span>
          )}
          {nextStep ? nextStep.text : t("Every criterion has full marks in this estimate.")}
        </p>
        <Button className="mt-1 self-start" onClick={onSeeGrade} size="sm" variant="outline">
          {t("See the grade")}
        </Button>
      </div>
    </Callout>
  );
}
