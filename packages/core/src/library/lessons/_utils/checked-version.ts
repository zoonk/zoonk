import "server-only";
import { type CallReuse, type ServiceTier } from "@zoonk/ai/provider-options";
import { type writeLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/v2/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { type CitedDocuments, citeMaterial } from "@zoonk/ai/tasks/v2/material/cite";
import { safeAsync } from "@zoonk/utils/error";
import { type LibraryProvenance } from "../../_utils/library-rows";
import {
  type LessonGateProblem,
  type LessonWritingContext,
  runLessonQualityGate,
} from "../../quality/lesson-quality-gate";
import { repairWrittenLesson } from "../../quality/lesson-repairs";
import { formatMaterialPages } from "../../sources/material-pages";
import { addQuestionBases } from "../../steps/question-bases";
import { type ConvertedScreen } from "../../steps/written-screens";
import { getFixReach } from "./fix-reach";
import { type LessonWritingInputs } from "./lesson-writing-inputs";
import { type LessonScreenToSave } from "./save-lesson-content";
import { type ScreenCitation, describeWrittenScreen, toScreenCitations } from "./screen-citations";

export type LessonAnalytics = Parameters<typeof writeLessonDraft>[0]["analytics"];

export type WrittenVersion = { lesson: WrittenLesson; provenanceByScreen: LibraryProvenance[] };

export type GateResult = Awaited<ReturnType<typeof runLessonQualityGate>>;

export type LessonGate = {
  analytics?: LessonAnalytics;
  context: LessonWritingContext;
  reuse: CallReuse;
  serviceTier?: ServiceTier;
  writerModel: string;
};

export type CheckedVersion =
  | { fixed: boolean; screens: ConvertedScreen[]; status: "passed"; version: WrittenVersion }
  | { problems: LessonGateProblem[]; status: "heldBack" };

function getLessonDocumentKind(inputs: LessonWritingInputs): CitedDocuments {
  return inputs.material.length > 0 ? "material" : "sources";
}

export function getLessonDocuments(inputs: LessonWritingInputs) {
  return getLessonDocumentKind(inputs) === "material" ? inputs.material : inputs.sources;
}

export function toScreensToSave({
  citations,
  inputs,
  screens,
  version,
}: {
  citations: readonly (ScreenCitation | null)[];
  inputs: LessonWritingInputs;
  screens: readonly ConvertedScreen[];
  version: WrittenVersion;
}): LessonScreenToSave[] {
  const stored = screens.flatMap((screen, index) =>
    screen.ok && version.provenanceByScreen[index] ? [index] : [],
  );

  const positions = screens.map((_, index) => {
    const position = stored.indexOf(index);
    return position === -1 ? null : position;
  });

  const withBases = addQuestionBases({ lesson: version.lesson, positions, screens });

  return stored.flatMap((index) => {
    const screen = withBases[index];
    const provenance = version.provenanceByScreen[index];

    const skillId =
      inputs.spec.screens[index]?.skills
        .map((skillIndex) => inputs.skillIds[skillIndex])
        .find((id) => Boolean(id)) ?? null;

    if (!screen?.ok || !provenance) {
      return [];
    }

    return [
      {
        citation: citations[index] ?? null,
        content: screen.content,
        kind: screen.kind,
        mathItem: screen.mathItem,
        provenance,
        skillId,
      },
    ];
  });
}

type CiteScreensInput = {
  analytics?: LessonAnalytics;
  inputs: LessonWritingInputs;
  lesson: WrittenLesson;
  serviceTier?: ServiceTier;
};

/** Model failures throw so the citation step can retry; use `citeScreensIfPossible` when citations are optional. */
export async function citeScreens({
  analytics,
  inputs,
  lesson,
  serviceTier,
}: CiteScreensInput): Promise<(ScreenCitation | null)[]> {
  const pages = getLessonDocuments(inputs);

  if (pages.length === 0) {
    return [];
  }

  const { data } = await citeMaterial({
    analytics,
    documents: getLessonDocumentKind(inputs),
    material: formatMaterialPages(pages),
    screens: lesson.screens.map((screen) => describeWrittenScreen(screen)),
    serviceTier,
  });

  return toScreenCitations({
    citations: data.citations,
    pages,
    screenCount: lesson.screens.length,
  });
}

/** Citation failures are omitted; use `citeScreens` when the caller must retry them. */
export async function citeScreensIfPossible(
  input: CiteScreensInput,
): Promise<(ScreenCitation | null)[]> {
  const { data } = await safeAsync(() => citeScreens(input));
  return data ?? [];
}

async function checkFixedLesson({
  draft,
  first,
  fixed,
  gate,
  review,
}: {
  draft: WrittenLesson;
  first: GateResult;
  fixed: WrittenLesson;
  gate: LessonGate;
  review: boolean;
}): Promise<GateResult> {
  const reach = getFixReach({
    draft,
    fixed,
    incorrect: first.incorrect,
    problems: [...first.blocking, ...first.minor],
  });

  const second = await runLessonQualityGate({
    ...gate,
    afterFix: true,
    allowActivityFallback: true,
    lesson: fixed,
    review: review && reach.strayed,
  });

  return {
    ...second,
    blocking: reach.strayed ? second.blocking : [...second.blocking, ...reach.unfixed],
    incorrect: reach.strayed ? second.incorrect : [...second.incorrect, ...reach.unfixed],
  };
}

export async function fixVersion({
  draft,
  first,
  gate,
  passes = 1,
  review,
}: {
  draft: WrittenVersion;
  first: GateResult;
  gate: LessonGate;
  passes?: number;
  review: boolean;
}): Promise<CheckedVersion> {
  const fix = await fixLessonDraft({
    ...gate.context,
    analytics: gate.analytics,
    lesson: draft.lesson,
    problems: [...first.blocking, ...first.minor],
    serviceTier: gate.serviceTier,
  });

  const changed = new Set(fix.data.changedScreens);
  const lesson = repairWrittenLesson({ language: gate.context.language, lesson: fix.data.lesson });

  const version: WrittenVersion = {
    lesson,
    provenanceByScreen: fix.data.lesson.screens.map(
      (_, index) =>
        (changed.has(index) ? fix.provenance : draft.provenanceByScreen[index]) ?? fix.provenance,
    ),
  };

  const checked = await checkFixedLesson({
    draft: draft.lesson,
    first,
    fixed: lesson,
    gate,
    review,
  });

  if (checked.blocking.length === 0) {
    return { fixed: true, screens: checked.screens, status: "passed", version };
  }

  return passes > 1
    ? fixVersion({ draft: version, first: checked, gate, passes: passes - 1, review })
    : { problems: checked.blocking, status: "heldBack" };
}

export async function checkVersion({
  draft: written,
  fixPasses,
  gate,
  review,
}: {
  draft: WrittenVersion;
  fixPasses?: number;
  gate: LessonGate;
  review: boolean;
}): Promise<CheckedVersion> {
  const lesson = repairWrittenLesson({ language: gate.context.language, lesson: written.lesson });
  const draft = { ...written, lesson };
  const first = await runLessonQualityGate({ ...gate, lesson, review });

  if (first.blocking.length === 0) {
    return { fixed: false, screens: first.screens, status: "passed", version: draft };
  }

  return fixVersion({ draft, first, gate, passes: fixPasses, review });
}
