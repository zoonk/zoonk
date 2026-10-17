"use client";

import { type PlanOperation } from "@zoonk/core/plans/contract";
import { useExtracted } from "next-intl";
import { useFormatIsoDate } from "../_utils/iso-date";

/** What the learner chooses to study: the goal's date (or none), all of it, its prerequisites. */
type ChoiceOperation = Extract<
  PlanOperation,
  { kind: "setBaseChoices" | "setFullCourse" | "setTargetDate" }
>;

type BaseChoices = Extract<PlanOperation, { kind: "setBaseChoices" }>["choices"];

/** "2 prerequisites get a quick lesson. 1 prerequisite is skipped." */
function useBaseChoicesSentence() {
  const t = useExtracted();

  return (choices: BaseChoices): string => {
    const count = (choice: BaseChoices[number]["choice"]) =>
      choices.filter((entry) => entry.choice === choice).length;

    const [deep, essential, quick, skip] = [
      count("deep"),
      count("essential"),
      count("quick"),
      count("skip"),
    ];

    return [
      deep > 0 &&
        t(
          "{count, plural, one {# prerequisite is studied in depth.} other {# prerequisites are studied in depth.}}",
          { count: deep },
        ),
      essential > 0 &&
        t(
          "{count, plural, one {# prerequisite keeps its essentials.} other {# prerequisites keep their essentials.}}",
          { count: essential },
        ),
      quick > 0 &&
        t(
          "{count, plural, one {# prerequisite gets a quick lesson.} other {# prerequisites get a quick lesson each.}}",
          { count: quick },
        ),
      skip > 0 &&
        t(
          "{count, plural, one {# prerequisite is skipped.} other {# prerequisites are skipped.}}",
          { count: skip },
        ),
    ]
      .filter(Boolean)
      .join(" ");
  };
}

export function isChoiceOperation(operation: PlanOperation): operation is ChoiceOperation {
  return (
    operation.kind === "setBaseChoices" ||
    operation.kind === "setFullCourse" ||
    operation.kind === "setTargetDate"
  );
}

/**
 * Says what the learner chose to study: a new date, no deadline (everything at their own pace),
 * an exam studied on after its date or ending at it again, and their prerequisites' choices.
 */
export function useChoiceSentence() {
  const t = useExtracted();
  const formatDate = useFormatIsoDate();
  const baseChoicesSentence = useBaseChoicesSentence();

  return (operation: ChoiceOperation): string => {
    switch (operation.kind) {
      case "setTargetDate":
        return operation.targetDate
          ? t("Date moved to {date}.", { date: formatDate(operation.targetDate, "long") })
          : t("No deadline: you study everything at your own pace.");
      case "setFullCourse":
        return operation.fullCourse
          ? t("You study everything: what doesn't fit before the exam comes after it.")
          : t("Your plan ends at the exam again.");
      case "setBaseChoices":
        return baseChoicesSentence(operation.choices);
      default:
        return operation satisfies never;
    }
  };
}
