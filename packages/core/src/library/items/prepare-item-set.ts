import { type WrittenItemSet, toSetItem } from "@zoonk/ai/tasks/items/write-set";
import { type LibraryProvenance } from "../_utils/library-rows";
import { type ItemSetToStore, type WrittenSetItem } from "./create-item-set";
import { MIN_SET_QUESTIONS, checkWrittenItemSet, repairWrittenItemSet } from "./item-set-checks";
import { type ItemSetContent } from "./item-set-content";

function toSetContent(set: WrittenItemSet): ItemSetContent<"case" | "chart" | "text"> {
  const { text, title, visual } = set;

  return set.kind === "chart" && visual
    ? { source: null, text: text.trim() || null, title, visual }
    : { source: null, text, title };
}

/** Null when the set fails its checks; otherwise its stimulus with the questions that passed. */
export function prepareWrittenItemSet({
  examBlueprintId,
  format,
  language,
  optionCount = null,
  provenance,
  skillIds,
  optionLanguage = null,
  written,
}: {
  examBlueprintId: string | null;
  format: "multipleChoice" | "trueFalse";
  language: string;
  optionCount?: number | null;
  provenance: LibraryProvenance;
  skillIds: readonly string[];
  optionLanguage?: string | null;
  written: WrittenItemSet;
}): ItemSetToStore<WrittenSetItem> | null {
  const set = repairWrittenItemSet(written);
  const check = checkWrittenItemSet({ set, skillCount: skillIds.length });

  if (check.set.length > 0) {
    return null;
  }

  return {
    content: toSetContent(set),
    examBlueprintId,
    items: set.questions.flatMap((question, index) =>
      check.questions[index]?.length === 0
        ? [{ format, item: toSetItem(question), skillId: skillIds[question.skill - 1] ?? "" }]
        : [],
    ),
    kind: set.kind,
    language,
    minItems: MIN_SET_QUESTIONS,
    optionCount,
    optionLanguage,
    provenance,
  };
}
