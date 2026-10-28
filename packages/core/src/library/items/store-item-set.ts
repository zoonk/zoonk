import { type WrittenItemSet, toSetItem } from "@zoonk/ai/tasks/v2/items/write-set";
import { type LibraryProvenance } from "../_utils/library-rows";
import { createItemSet } from "./create-item-set";
import { type RejectedItem } from "./create-items";
import { MIN_SET_QUESTIONS, checkWrittenItemSet, repairWrittenItemSet } from "./item-set-checks";
import { type ItemSetContent } from "./item-set-content";

function toSetContent(set: WrittenItemSet): ItemSetContent<"case" | "chart" | "text"> {
  const { text, title, visual } = set;

  return set.kind === "chart" && visual
    ? { source: null, text: text.trim() || null, title, visual }
    : { source: null, text, title };
}

/** Internal workflow bridge; not an app authorization boundary. */
export async function storeWrittenItemSet({
  examBlueprintId,
  format,
  language,
  optionCount = null,
  provenance,
  skillIds,
  written,
}: {
  examBlueprintId: string | null;
  format: "multipleChoice" | "trueFalse";
  language: string;
  optionCount?: number | null;
  provenance: LibraryProvenance;
  skillIds: readonly string[];
  written: WrittenItemSet;
}): Promise<{ problems: string[]; rejected: RejectedItem[]; setId: string | null }> {
  const set = repairWrittenItemSet(written);
  const check = checkWrittenItemSet({ set, skillCount: skillIds.length });

  if (check.set.length > 0) {
    return { problems: check.set, rejected: [], setId: null };
  }

  const askable = set.questions.flatMap((question, index) =>
    check.questions[index]?.length === 0 ? [{ index, question }] : [],
  );

  const stored = await createItemSet({
    content: toSetContent(set),
    examBlueprintId,
    items: askable.map(({ question }) => ({
      format,
      item: toSetItem(question),
      skillId: skillIds[question.skill - 1] ?? "",
    })),
    kind: set.kind,
    language,
    minItems: MIN_SET_QUESTIONS,
    optionCount,
    provenance,
  });

  const rejected = [
    ...check.questions.flatMap((problems, index) =>
      problems.length > 0 ? [{ index, problems }] : [],
    ),
    ...stored.rejected.map((entry) => ({
      ...entry,
      index: askable[entry.index]?.index ?? entry.index,
    })),
  ].toSorted((a, b) => a.index - b.index);

  const problems = stored.set
    ? []
    : [`Fewer than ${MIN_SET_QUESTIONS} questions passed the item checks.`];

  return { problems, rejected, setId: stored.set?.id ?? null };
}
