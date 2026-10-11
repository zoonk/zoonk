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
import { type ConvertedScreen } from "../../steps/written-screens";
import { getFixReach } from "./fix-reach";
import { type LessonWritingInputs } from "./lesson-writing-inputs";
import { type LessonScreenToSave } from "./save-lesson-content";
import { type ScreenCitation, describeWrittenScreen, toScreenCitations } from "./screen-citations";

export type LessonAnalytics = Parameters<typeof writeLessonDraft>[0]["analytics"];

/** A version of a lesson as written, before it's stored. */
export type WrittenVersion = {
  lesson: WrittenLesson;
  /** The run that wrote each screen: the draft's, or the fix pass's for screens it changed. */
  provenanceByScreen: LibraryProvenance[];
};

export type GateResult = Awaited<ReturnType<typeof runLessonQualityGate>>;

/** What every gate run of one lesson shares. */
export type LessonGate = {
  analytics?: LessonAnalytics;
  context: LessonWritingContext;
  /** How likely the lesson is to be read again, which picks its reviewer. */
  reuse: CallReuse;
  serviceTier?: ServiceTier;
  writerModel: string;
};

/** A version that passed the gate, as stored content, or the problems that held it back. */
export type CheckedVersion =
  | { fixed: boolean; screens: ConvertedScreen[]; status: "passed"; version: WrittenVersion }
  | { problems: LessonGateProblem[]; status: "heldBack" };

/** What a lesson was written from: the learner's material when it has any, else public sources. */
function getLessonDocumentKind(inputs: LessonWritingInputs): CitedDocuments {
  return inputs.material.length > 0 ? "material" : "sources";
}

/** The pages a lesson was written from: the learner's material, or public sources' passages. */
export function getLessonDocuments(inputs: LessonWritingInputs) {
  return getLessonDocumentKind(inputs) === "material" ? inputs.material : inputs.sources;
}

/** One version's screens as stored rows: each with its provenance, citation and skill. */
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
  return screens.flatMap((screen, index) => {
    const provenance = version.provenanceByScreen[index];
    const skillIndex = inputs.spec.screens[index]?.skills[0];

    if (!screen.ok || !provenance) {
      return [];
    }

    return [
      {
        citation: citations[index] ?? null,
        content: screen.content,
        kind: screen.kind,
        mathItem: screen.mathItem,
        provenance,
        skillId: skillIndex === undefined ? null : (inputs.skillIds[skillIndex] ?? null),
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

/**
 * A lesson built from the learner's material, or from public sources (a law, an exam notice),
 * cites a page on every screen it can. A failed model call throws, so the step citing a version
 * retries it.
 */
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

/**
 * The citations of a version published by a bigger step (a fix after a check), whose retry would
 * write the fix again: there they're a nicety, and the version goes without them when the model
 * call fails.
 */
export async function citeScreensIfPossible(
  input: CiteScreensInput,
): Promise<(ScreenCitation | null)[]> {
  const { data } = await safeAsync(() => citeScreens(input));
  return data ?? [];
}

/**
 * The gate after the fix pass: the code checks always run again, and the reviewer reads the fixed
 * lesson again only when the fix changed something no check pointed at. A screen the reviewer
 * found wrong that the fix left as it was still holds the lesson back (`getFixReach`).
 */
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

/**
 * A fix pass on a version its gate (`first`) held back, told every problem it found, then the
 * gate again (see `checkFixedLesson`), and another pass on what still holds it back while it has
 * `passes` left. Each screen a fix changed carries that fix's provenance.
 */
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
  /** The reviewer read the version, so it reads a fix that strayed from what it flagged. */
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

/**
 * A written version through the gate, after code repaired what it can (`repairWrittenLesson`): the
 * code checks always, the reviewer when `review` is set, and fix passes (one unless `fixPasses`
 * says more) when something blocks it. A fix pass's lesson is repaired the same way.
 */
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
