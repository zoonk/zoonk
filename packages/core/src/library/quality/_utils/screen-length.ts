import { type WrittenScreen } from "@zoonk/ai/tasks/lesson-writer/schema";
import {
  MAX_SCREEN_CHARACTERS,
  countScreenCharacters,
  toWeightedText,
} from "@zoonk/ai/tasks/lesson-writer/screen-length";
import { isJsonObject } from "@zoonk/utils/json";
import { removeMarkdownTables } from "@zoonk/utils/markdown-table";
import { safeParseStepContent } from "../../steps/contract/step-contract";
import { type ConvertedScreen } from "../../steps/written-screens";

/** One moment's reading: `part` names it in the problem, null for what a screen asks first. */
type ReadingStage = { part: string | null; texts: readonly (string | null | undefined)[] };

function reasons(texts: readonly string[]): ReadingStage[] {
  return texts.map((text, index) => ({ part: `reason ${index + 1}`, texts: [text] }));
}

function parseActivity(content: string) {
  try {
    const parsed: unknown = JSON.parse(content);
    return isJsonObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function getActivityStages(content: string): ReadingStage[] {
  const parsed = parseActivity(content);
  const check = isJsonObject(parsed?.check) ? parsed.check : null;
  const options = Array.isArray(check?.options) ? check.options : [];

  return [
    { part: null, texts: [asText(parsed?.prompt), asText(check?.question)] },
    { part: "explanation", texts: [asText(check?.explanation)] },
    ...reasons(
      options.flatMap((option) => asText(isJsonObject(option) ? option.reason : null) ?? []),
    ),
  ];
}

/**
 * Each moment's reading on a screen, tables left out since detail belongs in them: what it asks
 * before the learner acts, then each piece of feedback. A worked example keeps its problem and every
 * step it has revealed on screen, so all of it, result included, is one moment; its math isn't
 * prose.
 */
function getReadingStages(screen: WrittenScreen): ReadingStage[] {
  switch (screen.kind) {
    case "hookText":
      return [{ part: null, texts: [screen.text] }];
    case "explanation":
      return [{ part: null, texts: [screen.title, screen.text] }];
    case "hookGuess":
      return [
        { part: null, texts: [screen.question] },
        { part: "reveal", texts: [screen.reveal] },
      ];
    case "workedExample":
      return [
        {
          part: "problem, steps and result, shown together",
          texts: [
            screen.title,
            screen.problem,
            ...screen.steps.map((step) => step.text),
            screen.result,
          ],
        },
      ];
    case "check":
      return [
        { part: null, texts: [screen.context, screen.question] },
        ...reasons(screen.options.map((option) => option.reason)),
      ];
    case "mathCheck":
      return [
        { part: null, texts: [screen.context, screen.question] },
        { part: "right answer's reason", texts: [screen.correctReason] },
        ...reasons(screen.math.commonMistakes.map((mistake) => mistake.reason)),
      ];
    case "typedAnswer":
      return [
        { part: null, texts: [screen.context, screen.question] },
        { part: "sample answer", texts: [screen.sampleAnswer] },
      ];
    case "activity":
      return getActivityStages(screen.content);
    default:
      throw new Error("Unknown written screen kind.");
  }
}

type LongScreen = { characters: number; part: string | null; screen: number };

export function findLongScreens(screens: readonly WrittenScreen[]): LongScreen[] {
  return screens.flatMap((screen, index) =>
    getReadingStages(screen).flatMap(({ part, texts }) => {
      const text = texts.filter(Boolean).join("\n");
      const characters = countScreenCharacters(removeMarkdownTables(text));
      return characters > MAX_SCREEN_CHARACTERS ? [{ characters, part, screen: index }] : [];
    }),
  );
}

function weighStrings(value: unknown): unknown {
  if (typeof value === "string") {
    return toWeightedText(value);
  }

  if (Array.isArray(value)) {
    return value.map((item) => weighStrings(item));
  }

  return isJsonObject(value)
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, weighStrings(item)]))
    : value;
}

/**
 * Each text a screen shows (an option, a label, a template's text) against its own limit in the
 * step contract, counted the way the screen cap counts: a contract limit counts characters, so a
 * Japanese option within it can still weigh twice as much.
 */
export function findOverweightTexts(converted: ConvertedScreen): string[] {
  if (!converted.ok) {
    return [];
  }

  const parsed = safeParseStepContent(converted.kind, weighStrings(converted.content));

  return (parsed.error?.issues ?? []).flatMap((issue) =>
    issue.code === "too_big" && issue.origin === "string"
      ? [
          `Its ${issue.path.join(" ")} is over its limit of ${String(issue.maximum)} characters, counting each Chinese, Japanese or Korean character as two. Shorten it.`,
        ]
      : [],
  );
}
