import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type ContentFixEffect } from "@zoonk/core/staff/content-fixes/contract";
import { TriangleAlertIcon } from "lucide-react";

function describeEffect({
  effect,
  rowLabels,
}: {
  effect: ContentFixEffect;
  rowLabels: ReadonlyMap<string, string>;
}): string {
  switch (effect.kind) {
    case "lessonVersion":
      return "Learners who open the lesson next get the fixed version.";
    case "answerExplanationsDeleted":
      return `${String(effect.count)} saved ${effect.count === 1 ? "explanation" : "explanations"} of wrong answers on ${rowLabels.get(effect.stepId) ?? "this screen"} ${effect.count === 1 ? "is" : "are"} deleted. New ones are written from the fixed screen.`;
    case "answerKeyChanged":
      return `Which answer counts as right changes on ${rowLabels.get(effect.id) ?? "this screen"}.`;
    case "questionChanged":
      return `The question or options learners read change on ${rowLabels.get(effect.id) ?? "this screen"}. Someone answering the old screen is still graded by the same answer key.`;
    case "marksKept":
      return "The lesson's idea marks, icons and maps stay as they were drawn.";
    case "screenLeftOut":
      return `${rowLabels.get(effect.stepId) ?? "This screen"} asks about its numbered picture, so learners no longer get it.`;
    case "itemRetired":
      return "New practice skips the question. Sessions that already hold it keep it.";
    case "itemRestored":
      return "New practice can pick the question again.";
    case "itemExplanationsDeleted":
      return `${String(effect.count)} saved ${effect.count === 1 ? "explanation" : "explanations"} of wrong answers to this question ${effect.count === 1 ? "is" : "are"} deleted. New ones are written from the fixed question.`;
    case "itemReplaced":
      return "New practice asks the corrected copy instead. Sessions that already hold this question keep grading it, its answers and history stay with it, and its past mistakes no longer replay.";
    case "slugKept":
      return "The title changes, but the address keeps its old slug.";
    default:
      return "";
  }
}

export function ContentFixEffects({
  fix,
}: {
  fix: Pick<ContentFixDetail, "effects" | "rowLabels">;
}) {
  if (fix.effects.length === 0) {
    return <p className="text-muted-foreground text-sm">Nothing else changes.</p>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {fix.effects.map((effect) => (
        <li className="flex gap-2" key={JSON.stringify(effect)}>
          {effect.kind === "answerKeyChanged" || effect.kind === "itemReplaced" ? (
            <TriangleAlertIcon
              aria-hidden="true"
              className="text-destructive-text mt-0.5 size-4 shrink-0"
            />
          ) : (
            <span aria-hidden="true" className="text-muted-foreground w-4 shrink-0 text-center">
              ·
            </span>
          )}
          {describeEffect({ effect, rowLabels: fix.rowLabels })}
        </li>
      ))}
    </ul>
  );
}
