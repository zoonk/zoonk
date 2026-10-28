import { type GoalKind } from "@zoonk/db";
import { type PlanOperation } from "../plan-contract";
import { type BaseChoice, type PlanState } from "./plan-state";

type OperationResult = { error: "notExam" } | { state: PlanState };

const STUDY_KINDS: ReadonlySet<PlanOperation["kind"]> = new Set([
  "setBaseChoices",
  "setDifficultyBias",
  "setFullCourse",
  "setPracticeBias",
  "setWrittenCadence",
]);

function setBaseChoices({
  choices,
  state,
}: {
  choices: readonly { choice: BaseChoice; skillId: string }[];
  state: PlanState;
}): PlanState {
  const named = new Set(choices.map((entry) => entry.skillId));
  const kept = state.settings.baseChoices.filter((entry) => !named.has(entry.skillId));

  const added = choices.flatMap(({ choice, skillId }) =>
    choice === "essential" ? [] : [{ choice, skillId }],
  );

  return { ...state, settings: { ...state.settings, baseChoices: [...kept, ...added] } };
}

export type StudyOperation = Extract<
  PlanOperation,
  {
    kind:
      | "setBaseChoices"
      | "setDifficultyBias"
      | "setFullCourse"
      | "setPracticeBias"
      | "setWrittenCadence";
  }
>;

export function applyStudyOperation({
  goalKind,
  operation,
  state,
}: {
  goalKind: GoalKind;
  operation: StudyOperation;
  state: PlanState;
}): OperationResult {
  const withSettings = (settings: Partial<PlanState["settings"]>): OperationResult => ({
    state: { ...state, settings: { ...state.settings, ...settings } },
  });

  switch (operation.kind) {
    case "setPracticeBias":
      return withSettings({ practiceBias: operation.bias });
    case "setDifficultyBias":
      return withSettings({ difficultyBias: operation.bias });
    case "setWrittenCadence":
      return withSettings({ writtenCadence: operation.cadence });
    case "setFullCourse":
      return goalKind === "exam"
        ? withSettings({ fullCourse: operation.fullCourse })
        : { error: "notExam" };
    case "setBaseChoices":
      return { state: setBaseChoices({ choices: operation.choices, state }) };
    default:
      return operation satisfies never;
  }
}

export function isStudyOperation(operation: PlanOperation): operation is StudyOperation {
  return STUDY_KINDS.has(operation.kind);
}
