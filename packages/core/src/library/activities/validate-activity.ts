import { isJsonObject } from "@zoonk/utils/json";
import { type z } from "zod";
import { type ActivityCheck } from "./activity-schemas";
import {
  type ActivityStepContent,
  activityContentSchema,
  getActivityTemplate,
  showsActivityData,
} from "./activity-templates";
import {
  type ActivityCheckTarget,
  type ActivityIssue,
  type ActivityTemplate,
} from "./define-activity-template";
import { sampleExpression } from "./expression/sample-expression";
import { withinTolerance } from "./templates/_utils/pattern-checks";
import { issue } from "./templates/_utils/template-helpers";

/** How far a choice's value may sit from the computed answer: "about 1 in 4" for 0.246 is fine. */
const CHOICE_VALUE_TOLERANCE = 0.2;
const MIN_CHOICE_GAP = 1e-9;

type ActivityValidationResult =
  | { content: ActivityStepContent; ok: true }
  | { issues: ActivityIssue[]; ok: false };

function toIssue(zodIssue: z.core.$ZodIssue): ActivityIssue {
  const path = zodIssue.path.map(String).join(".");
  const isLongText = zodIssue.code === "too_big" && zodIssue.origin === "string";

  return issue(isLongText ? "labelTooLong" : "invalidSchema", path, zodIssue.message);
}

function checkTarget(check: Exclude<ActivityCheck, { kind: "interaction" }>): ActivityCheckTarget {
  return {
    inputs: Object.fromEntries((check.inputs ?? []).map((input) => [input.name, input.value])),
    output: check.output ?? null,
  };
}

function numericIssues(
  template: ActivityTemplate,
  content: ActivityStepContent,
  check: Extract<ActivityCheck, { kind: "numeric" }>,
): ActivityIssue[] {
  const computed = template.computeValue(content.fields, checkTarget(check));

  if (computed === null) {
    return [
      issue(
        "answerMismatch",
        "check",
        "Code can't compute an answer for this check's inputs and output",
      ),
    ];
  }

  return withinTolerance({ expected: computed, tolerance: check.tolerance, value: check.answer })
    ? []
    : [
        issue(
          "answerMismatch",
          "check.answer",
          `The answer ${String(check.answer)} doesn't match the computed ${String(computed)}`,
        ),
      ];
}

/**
 * A choice check can prove itself with numbers: each option carries the value it stands for, and
 * the one closest to the computed answer must be the correct one, with no tie.
 */
function choiceIssues(
  template: ActivityTemplate,
  content: ActivityStepContent,
  check: Extract<ActivityCheck, { kind: "choice" }>,
): ActivityIssue[] {
  const valued = check.options.filter((option) => option.value !== undefined);

  if (valued.length === 0) {
    return template.choicesNeedValues
      ? [issue("answerMismatch", "check.options", "Every option needs the value it stands for")]
      : [];
  }

  const computed = template.computeValue(content.fields, checkTarget(check));

  if (valued.length !== check.options.length || computed === null) {
    return [
      issue(
        "answerMismatch",
        "check.options",
        "Code can't verify these options: give every option a value this template computes",
      ),
    ];
  }

  const [closest, runnerUp] = check.options
    .map((option) => ({ distance: Math.abs((option.value ?? Number.NaN) - computed), option }))
    .toSorted((a, b) => a.distance - b.distance);

  const tolerance = Math.max(Math.abs(computed) * CHOICE_VALUE_TOLERANCE, MIN_CHOICE_GAP);

  const isTie =
    runnerUp !== undefined &&
    closest !== undefined &&
    runnerUp.distance - closest.distance < MIN_CHOICE_GAP;

  return closest?.option.isCorrect && closest.distance <= tolerance && !isTie
    ? []
    : [
        issue(
          "answerMismatch",
          "check.options",
          `The correct option must be the one closest to the computed ${String(computed)}`,
        ),
      ];
}

function checkIssues(template: ActivityTemplate, content: ActivityStepContent): ActivityIssue[] {
  const { check } = content;

  if (!template.checks.includes(check.kind)) {
    return [
      issue(
        "checkNotAllowed",
        "check.kind",
        `"${template.id}" doesn't support ${check.kind} checks`,
      ),
    ];
  }

  if (check.kind === "numeric") {
    return numericIssues(template, content, check);
  }

  if (check.kind === "choice") {
    return choiceIssues(template, content, check);
  }

  return template.computeExpected(content.fields)
    ? []
    : [issue("answerMismatch", "fields", "Code can't compute the answer this interaction expects")];
}

function formulaIssues(template: ActivityTemplate, content: ActivityStepContent): ActivityIssue[] {
  return template.listFormulas(content.fields).flatMap((formula) => {
    const sampled = sampleExpression(formula);

    if (sampled.ok) {
      return [];
    }

    const at = sampled.point ? ` at ${JSON.stringify(sampled.point)}` : "";
    return [issue("formulaFails", formula.path, `${sampled.error}${at}`)];
  });
}

function ruleIssues(content: ActivityStepContent): ActivityIssue[] {
  const template = getActivityTemplate(content.template);

  if (!template) {
    return [issue("unknownTemplate", "template", `Unknown template "${content.template}"`)];
  }

  return [
    ...(template.needsData && !content.data
      ? [issue("missingDataSource", "data", "Cite the data's source or mark it as an example")]
      : []),
    ...formulaIssues(template, content),
    ...checkIssues(template, content),
    ...template.verifyFields(content.fields),
  ];
}

/**
 * Runs every publishing rule on generated activity content: the template's schema and label
 * limits, a check tied to the interaction, formulas that work across their whole range, answers
 * recomputed by code, cited or example-labeled data, and the template's own consistency rules.
 * Issues say what to fix, so the writer can repair the activity and try again.
 */
export function validateActivity(input: unknown): ActivityValidationResult {
  if (!isJsonObject(input)) {
    return { issues: [issue("invalidSchema", "", "An activity must be an object")], ok: false };
  }

  if (typeof input.template !== "string" || !getActivityTemplate(input.template)) {
    return {
      issues: [
        issue(
          "unknownTemplate",
          "template",
          `Unknown template ${JSON.stringify(input.template) ?? "(missing)"}`,
        ),
      ],
      ok: false,
    };
  }

  if (input.check === undefined || input.check === null) {
    return {
      issues: [
        issue("missingCheck", "check", "An activity needs a check tied to what the learner does"),
      ],
      ok: false,
    };
  }

  const parsed = activityContentSchema.safeParse(input);

  if (!parsed.success) {
    return { issues: parsed.error.issues.map((zodIssue) => toIssue(zodIssue)), ok: false };
  }

  const issues = ruleIssues(parsed.data);

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  // A template that shows no data keeps no data label, which would read as a note on nothing.
  const content = showsActivityData(parsed.data.template)
    ? parsed.data
    : { ...parsed.data, data: undefined };

  return { content, ok: true };
}
