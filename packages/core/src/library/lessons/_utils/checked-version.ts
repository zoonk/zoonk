import "server-only";
import { type ServiceTier } from "@zoonk/ai/provider-options";
import { type writeLessonDraft } from "@zoonk/ai/tasks/lesson-writer";
import { fixLessonDraft } from "@zoonk/ai/tasks/lesson-writer/fix";
import { type WrittenLesson } from "@zoonk/ai/tasks/lesson-writer/schema";
import { type CitedDocuments, citeMaterial } from "@zoonk/ai/tasks/material/cite";
import { safeAsync } from "@zoonk/utils/error";
import { type LessonWritingContext, runLessonQualityGate } from "../../quality/lesson-quality-gate";
import { repairWrittenLesson } from "../../quality/lesson-repairs";
import { type SourceVersion, toSourceVersions } from "../../sources/content-review-flags";
import { formatMaterialPages } from "../../sources/material-pages";
import { addQuestionBases } from "../../steps/question-bases";
import { type ConvertedScreen } from "../../steps/written-screens";
import { type LessonWritingInputs } from "./lesson-writing-inputs";
import { type LessonScreenToSave, type ScreenProvenance } from "./save-lesson-content";
import { type ScreenCitation, describeWrittenScreen, toScreenCitations } from "./screen-citations";

export type LessonAnalytics = Parameters<typeof writeLessonDraft>[0]["analytics"];

export type WrittenVersion = { lesson: WrittenLesson; provenanceByScreen: ScreenProvenance[] };

export type GateResult = Awaited<ReturnType<typeof runLessonQualityGate>>;

/** `sources` are the versions of the documents `context` gives the writer. */
export type LessonGate = {
  analytics?: LessonAnalytics;
  context: LessonWritingContext;
  serviceTier?: ServiceTier;
  sources: SourceVersion[];
  writerModel: string;
};

export type CheckedVersion = {
  fixed: boolean;
  screens: ConvertedScreen[];
  status: "passed";
  version: WrittenVersion;
};

function getLessonDocumentKind(inputs: LessonWritingInputs): CitedDocuments {
  return inputs.material.length > 0 ? "material" : "sources";
}

export function getLessonDocuments(inputs: LessonWritingInputs) {
  return getLessonDocumentKind(inputs) === "material" ? inputs.material : inputs.sources;
}

export function readLessonSources(inputs: LessonWritingInputs): SourceVersion[] {
  return toSourceVersions(getLessonDocuments(inputs));
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

export async function checkFixedLesson({
  fixed,
  gate,
  review,
}: {
  fixed: WrittenLesson;
  gate: LessonGate;
  review: boolean;
}): Promise<GateResult> {
  return runLessonQualityGate({ ...gate, allowActivityFallback: true, lesson: fixed, review });
}

export async function fixVersionDraft({
  draft,
  first,
  gate,
}: {
  draft: WrittenVersion;
  first: GateResult;
  gate: LessonGate;
}): Promise<WrittenVersion> {
  const fix = await fixLessonDraft({
    ...gate.context,
    analytics: gate.analytics,
    lesson: draft.lesson,
    model: gate.writerModel,
    problems: first.blocking.map((problem) => ({
      ...problem,
      source: problem.source === "code" ? "check" : "review",
    })),
    serviceTier: gate.serviceTier,
  });

  const changed = new Set(fix.data.changedScreens);

  const repaired = repairWrittenLesson({
    language: gate.context.language,
    lesson: fix.data.lesson,
    spec: gate.context.spec,
  });

  const fixed = { ...fix.provenance, sources: gate.sources };

  return {
    lesson: repaired,
    provenanceByScreen: fix.data.lesson.screens.map(
      (_, index) => (changed.has(index) ? fixed : draft.provenanceByScreen[index]) ?? fixed,
    ),
  };
}
