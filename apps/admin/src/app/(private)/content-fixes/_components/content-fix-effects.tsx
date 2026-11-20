import { AdminSectionEmpty } from "@/components/admin-section";
import { screenKindLabel } from "@/components/screen-words";
import { type ContentFixDetail } from "@/data/content-fixes/get-content-fix";
import { formatMinutes } from "@/lib/format-duration";
import { type ContentFixEffect } from "@zoonk/core/staff/content-fixes/contract";
import { TriangleAlertIcon } from "lucide-react";
import { readMapIdeas } from "./content-fix-map";
import { readScreenRows, writtenFromChangedScreens } from "./screen-list";

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
    case "planChanged":
      return "When this lesson's screens are checked or written again, they follow the fixed plan.";
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

type Line = { text: string; warning: boolean };

function screenName(row: { position: number; screen: { content: unknown; kind: string } }) {
  return `screen ${String(row.position)} · ${screenKindLabel(row.screen)}`;
}

/**
 * What a new screen list does besides what it shows, read from the screens it stores: a changed
 * right answer, what was written from a changed screen, and the summary's new ideas.
 */
function screenListLines(changes: ContentFixDetail["changes"]): Line[] {
  return changes.flatMap((change) => {
    if (change.model !== "Lesson" || change.op !== "setScreens") {
      return [];
    }

    const rows = readScreenRows(change);

    const answerKeys = rows.flatMap((row) =>
      row.status === "changed" && row.answerKey
        ? [
            {
              text: `Which answer counts as right changes on ${screenName(row)}. Learners who started the lesson before the fix aren't marked wrong for it.`,
              warning: true,
            },
          ]
        : [],
    );

    const written = writtenFromChangedScreens(rows).flatMap(({ explanations, row, tutorAnswers }) =>
      [
        explanations > 0 && { count: explanations, kind: "answerExplanationsDeleted" as const },
        tutorAnswers > 0 && { count: tutorAnswers, kind: "tutorAnswersDeleted" as const },
      ]
        .filter((entry) => entry !== false)
        .map((entry) => ({
          text: describeWrittenFromScreen({ ...entry, screen: `screen ${String(row.position)}` }),
          warning: false,
        })),
    );

    const summary =
      readMapIdeas(change).some((idea) => idea.status !== "same") &&
      change.after.screens.some((screen) => screen.kind === "summary");

    return [
      ...answerKeys,
      ...written,
      ...(summary
        ? [{ text: "The summary screen shows the map's new ideas.", warning: false }]
        : []),
    ];
  });
}

function planLines(changes: ContentFixDetail["changes"]): Line[] {
  return changes.flatMap((change) => {
    if (change.model !== "Lesson" || change.op !== "setPlan") {
      return [];
    }

    const [, minutes] = change.fields;

    return minutes
      ? [
          {
            text: `The lesson's time goes from ${formatMinutes(minutes.before)} to ${formatMinutes(minutes.after)}.`,
            warning: false,
          },
        ]
      : [];
  });
}

/** A change to what counts as right, which staff should look at before approving. */
function isWarning(effect: ContentFixDetail["effects"][number]): boolean {
  return effect.kind === "answerKeyChanged" || effect.kind === "itemReplaced";
}

function effectLines(fix: Pick<ContentFixDetail, "changes" | "effects" | "rowLabels">): Line[] {
  const screenList = fix.changes.some(
    (change) => change.model === "Lesson" && change.op === "setScreens",
  );

  const planOnly = fix.effects.every((effect) => effect.kind === "planChanged");

  const stored = fix.effects.map((effect) => {
    const text = describeEffect({ effect, rowLabels: fix.rowLabels });
    const warning = isWarning(effect);

    if (effect.kind === "lessonVersion" && screenList) {
      return {
        text: `${text} Learners in the lesson now finish the version they started.`,
        warning,
      };
    }

    return {
      text:
        effect.kind === "planChanged" && planOnly
          ? `The screens don't change, so learners see nothing new. ${text}`
          : text,
      warning,
    };
  });

  const lines = [...stored, ...screenListLines(fix.changes), ...planLines(fix.changes)].filter(
    (line) => line.text,
  );

  return [...lines.filter((line) => line.warning), ...lines.filter((line) => !line.warning)];
}

/** One effect is a sentence; several are a list. */
export function ContentFixEffects({
  fix,
}: {
  fix: Pick<ContentFixDetail, "changes" | "effects" | "rowLabels">;
}) {
  const lines = effectLines(fix);
  const [only] = lines;

  if (!only) {
    return <AdminSectionEmpty>Nothing else changes.</AdminSectionEmpty>;
  }

  if (lines.length === 1 && !only.warning) {
    return <p className="text-sm">{only.text}</p>;
  }

  return (
    <ul className="flex flex-col gap-2 text-sm">
      {lines.map((line) => (
        <li className="flex gap-2" key={line.text}>
          {line.warning ? (
            <TriangleAlertIcon aria-hidden="true" className="text-warning mt-0.5 size-4 shrink-0" />
          ) : (
            <span aria-hidden="true" className="text-muted-foreground w-4 shrink-0 text-center">
              ·
            </span>
          )}
          {line.text}
        </li>
      ))}
    </ul>
  );
}
