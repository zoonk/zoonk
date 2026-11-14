import { AdminSectionEmpty } from "@/components/admin-section";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { type ContentFixEffect } from "@zoonk/core/staff/content-fixes/contract";
import { TriangleAlertIcon } from "lucide-react";

function countOf({ count, many, one }: { count: number; many: string; one: string }): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function describeWrittenFromScreen({
  count,
  kind,
  screen,
}: {
  count: number;
  kind: "answerExplanationsDeleted" | "tutorAnswersDeleted";
  screen: string;
}): string {
  const rows =
    kind === "answerExplanationsDeleted"
      ? countOf({
          count,
          many: "saved explanations of wrong answers on",
          one: "saved explanation of wrong answers on",
        })
      : countOf({ count, many: "shared tutor answers about", one: "shared tutor answer about" });

  return `${rows} ${screen} ${count === 1 ? "is" : "are"} deleted. New ones are written from the fixed screen.`;
}

function screenLabel(rowLabels: ReadonlyMap<string, string>, id: string): string {
  return rowLabels.get(id) ?? "this screen";
}

function describeLevelTestChange({
  answerKeys,
  questions,
  speaking,
}: Extract<ContentFixEffect, { kind: "levelTestChanged" }>): string {
  return [
    questions.length > 0 && `Learners read new words in ${questions.join(", ")}.`,
    answerKeys.length > 0 && `The right option changes in ${answerKeys.join(", ")}.`,
    speaking.length > 0 && `The sentence to say changes at ${speaking.join(", ")}.`,
    "Learners already taking the test aren't marked wrong for it.",
  ]
    .filter((line) => line !== false)
    .join(" ");
}

// oxlint-disable-next-line complexity -- Each effect describes one distinct approval consequence.
function describeEffect({
  effect,
  rowLabels,
}: {
  effect: ContentFixEffect;
  rowLabels: ReadonlyMap<string, string>;
}): string {
  switch (effect.kind) {
    case "structureAddressKept":
      return "The lesson keeps its web address after it leaves the chapter. Learners whose plan already has it keep it until their plan is next rebuilt.";
    case "existingPlanGraphsKept":
      return "New plans use the corrected skill graph. Plans made before keep the copy they were made with.";
    case "optionPicturesUnlinked":
      return `${countOf({ count: effect.count, many: "pictures come", one: "picture comes" })} off the options. The files are kept, so undoing this fix can put them back.`;
    case "itemSetReplaced":
      return "Practice from now on uses a corrected copy of the whole set. Sessions already open keep the original passage and questions.";
    case "itemSetRestored":
      return "Practice from now on uses the original set again. Sessions that already have the corrected copy keep it.";
    case "mindMapRedrawOwed":
      return "The outline changes right away. Its old picture comes off and a new one is drawn soon after; learners who have the map open keep what they see.";
    case "lessonVersion":
      return "Learners who open the lesson next get the fixed version.";
    case "answerExplanationsDeleted":
    case "tutorAnswersDeleted":
      return describeWrittenFromScreen({
        count: effect.count,
        kind: effect.kind,
        screen: screenLabel(rowLabels, effect.stepId),
      });
    case "variantsKept":
      return `${countOf({ count: effect.count, many: "other versions", one: "other version" })} of ${screenLabel(rowLabels, effect.stepId)}, written for a learner's field or tool, ${effect.count === 1 ? "stays" : "stay"} as before. Check ${effect.count === 1 ? "it still matches" : "they still match"}.`;
    case "answerKeyChanged":
      return `Which answer counts as right changes on ${screenLabel(rowLabels, effect.id)}. Learners who started the lesson before the fix aren't marked wrong for it.`;
    case "questionChanged":
      return `The question or options learners read change on ${screenLabel(rowLabels, effect.id)}. Someone answering the old screen is still graded by the same answer key.`;
    case "marksKept":
      return "The lesson's pictures (its icons, the picture beside each idea and its maps) aren't drawn again. Check they still fit.";
    case "screenLeftOut":
      return `${rowLabels.get(effect.stepId) ?? "This screen"} points at numbered parts of the picture, so without it learners no longer see that screen.`;
    case "itemRetired":
      return "New practice skips the question. Sessions that already hold it keep it.";
    case "itemRestored":
      return "New practice can pick the question again.";
    case "itemExplanationsDeleted":
      return `${countOf({ count: effect.count, many: "saved explanations", one: "saved explanation" })} of wrong answers to this question ${effect.count === 1 ? "is" : "are"} deleted. New ones are written from the fixed question.`;
    case "levelTestChanged":
      return describeLevelTestChange(effect);
    case "itemReplaced":
      return "New practice asks the corrected copy instead. Sessions that already have this question still grade it, and its answers stay with it. Learners' past mistakes on it stop coming back in practice.";
    case "slugKept":
      return "The title changes, but the web address keeps the old title's words.";
    case "voiceOwed":
      return "A clip of the new text is recorded first, and you can hear it here. Approving writes the text and its clip together.";
    case "lessonsUpdated":
      return `${countOf({ count: effect.lessonIds.length, many: "lessons show", one: "lesson shows" })} it, and learners who open them next get the fix. Learners already in one aren't marked wrong for it.`;
    case "spokenScreensCopied":
      return `${countOf({ count: effect.stepIds.length, many: "speaking screens take", one: "speaking screen takes" })} the new sentence too.`;
    case "sentenceOrdersOwed":
      return `The other word orders accepted as right in ${countOf({ count: effect.lessonIds.length, many: "lessons", one: "lesson" })} are cleared and written again right after approval. Until they're written, those sentence screens wait.`;
    case "pronunciationsKept":
      return `The word's text changes, but ${countOf({ count: effect.count, many: "pronunciation guides stay", one: "pronunciation guide stays" })} as they are. Check they still match.`;
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
    return <AdminSectionEmpty>Nothing else changes.</AdminSectionEmpty>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {fix.effects.map((effect) => (
        <li className="flex gap-2" key={JSON.stringify(effect)}>
          {effect.kind === "answerKeyChanged" || effect.kind === "itemReplaced" ? (
            <TriangleAlertIcon aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
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
