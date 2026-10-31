import { isJsonObject } from "@zoonk/utils/json";
import { type z } from "zod";
import { type ActivityCheck } from "./activity-schemas";
import {
  type ActivityStepContent,
  type ExploreActivityContent,
  activityContentSchema,
  exploreActivitySchema,
  exploresSolved,
  getActivityTemplate,
  isExploreTemplate,
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

function choiceIssues(
  template: ActivityTemplate,
  content: ActivityStepContent,
  check: Extract<ActivityCheck, { kind: "choice" }>,
): ActivityIssue[] {
  const valued = check.options.filter((option) => option.value !== undefined);

  if (valued.length === 0) {
    return template.choicesNeedValues(content.fields)
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

  if (!template.allowedChecks(content.fields).includes(check.kind)) {
    return [
      issue(
        "checkNotAllowed",
        "check.kind",
        `"${template.id}" doesn't support ${check.kind} checks here`,
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

function formulaIssues(template: ActivityTemplate, fields: unknown): ActivityIssue[] {
  return template.listFormulas(fields).flatMap((formula) => {
    const sampled = sampleExpression(formula);

    if (sampled.ok) {
      return [];
    }

    const at = sampled.point ? ` at ${JSON.stringify(sampled.point)}` : "";
    return [issue("formulaFails", formula.path, `${sampled.error}${at}`)];
  });
}

function fieldIssues(
  template: ActivityTemplate,
  content: { data?: unknown; fields: unknown },
): ActivityIssue[] {
  return [
    ...(template.showsData(content.fields) && !content.data
      ? [issue("missingDataSource", "data", "Cite the data's source or mark it as an example")]
      : []),
    ...formulaIssues(template, content.fields),
    ...template.verifyFields(content.fields),
  ];
}

function ruleIssues(content: ActivityStepContent): ActivityIssue[] {
  const template = getActivityTemplate(content.template);

  if (!template) {
    return [issue("unknownTemplate", "template", `Unknown template "${content.template}"`)];
  }

  return [...fieldIssues(template, content), ...checkIssues(template, content)];
}

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

  const content = showsActivityData(parsed.data)
    ? parsed.data
    : { ...parsed.data, data: undefined };

  return { content, ok: true };
}

type ExploreValidationResult =
  | { content: ExploreActivityContent; ok: true }
  | { issues: ActivityIssue[]; ok: false };

function solvedStateIssues(template: ActivityTemplate, fields: unknown): ActivityIssue[] {
  return exploresSolved(template.id) && !template.computeExpected(fields)
    ? [issue("answerMismatch", "fields", "Code can't compute the end state this template shows")]
    : [];
}

export function validateExploreActivity(input: unknown): ExploreValidationResult {
  if (!isJsonObject(input) || typeof input.template !== "string") {
    return {
      issues: [issue("invalidSchema", "", "An explored activity names its template")],
      ok: false,
    };
  }

  const template = getActivityTemplate(input.template);

  if (!template || !isExploreTemplate(input.template)) {
    return {
      issues: [
        issue(
          "unknownTemplate",
          "template",
          `"${input.template}" can't be explored on an explanation screen`,
        ),
      ],
      ok: false,
    };
  }

  const parsed = exploreActivitySchema.safeParse(input);

  if (!parsed.success) {
    return { issues: parsed.error.issues.map((zodIssue) => toIssue(zodIssue)), ok: false };
  }

  const issues = [
    ...fieldIssues(template, parsed.data),
    ...solvedStateIssues(template, parsed.data.fields),
  ];

  if (issues.length > 0) {
    return { issues, ok: false };
  }

  const content = showsActivityData(parsed.data)
    ? parsed.data
    : { ...parsed.data, data: undefined };

  return { content, ok: true };
}
