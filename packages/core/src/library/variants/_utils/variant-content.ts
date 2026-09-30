import {
  type StepVariantKind,
  type WrittenVariant,
} from "@zoonk/ai/tasks/v2/variants/step-variant";
import { type CourseLevel, type StepKind } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { checkScreenText } from "../../quality/lesson-code-checks";
import { safeParseStepContent } from "../../steps/contract/step-contract";
import { toStepContent } from "../../steps/written-screens";

/**
 * What a variant keeps from the original screen: its example-line slot, and
 * for "Simpler" and "Go deeper" its picture, since the idea is the same. A
 * field or tool version changes the example, so the picture may not fit.
 */
function getCarriedFields({
  kind,
  original,
}: {
  kind: StepVariantKind;
  original: unknown;
}): Record<string, unknown> {
  if (!isJsonObject(original)) {
    return {};
  }

  const keepImage = (kind === "simpler" || kind === "deeper") && original.image !== undefined;

  return {
    ...(keepImage ? { image: original.image } : {}),
    ...(original.exampleLineSlot === undefined
      ? {}
      : { exampleLineSlot: original.exampleLineSlot }),
  };
}

/**
 * Turns a written variant into stored content of the original step's kind,
 * running the same contract and text checks as lessons. Problems mean the
 * variant can't be shown.
 */
export function toVariantContent({
  kind,
  language,
  level,
  original,
  stepKind,
  written,
}: {
  kind: StepVariantKind;
  language: string;
  level: CourseLevel;
  original: unknown;
  stepKind: StepKind;
  written: WrittenVariant;
}): { content: object; ok: true } | { ok: false; problems: string[] } {
  const screen = written.kind === "explanation" ? { ...written, exampleLineIdea: null } : written;
  const converted = toStepContent(screen, { allowImage: false, language });

  if (!converted.ok) {
    return converted;
  }

  if (converted.kind !== stepKind) {
    return { ok: false, problems: [`Wrote a ${converted.kind} for a ${stepKind} screen.`] };
  }

  const content = { ...converted.content, ...getCarriedFields({ kind, original }) };
  const parsed = safeParseStepContent(stepKind, content);
  const textProblems = checkScreenText({ language, level, screen });

  if (!parsed.success || textProblems.length > 0) {
    return {
      ok: false,
      problems: [...(parsed.error?.issues.map((issue) => issue.message) ?? []), ...textProblems],
    };
  }

  return { content: parsed.data, ok: true };
}
