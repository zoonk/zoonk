import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { createSourceChangeNotice } from "../sources/content-review-flags";
import {
  type BlueprintContent,
  type ExamDate,
  examEditionSchema,
  examStructureSchema,
  topicFrequencySchema,
} from "./blueprint-contract";
import { type BlueprintChange, mergeBlueprintContent, movesExamDays } from "./blueprint-diff";
import { type ExamIdentity, buildExamIdentityKey, findExamBlueprintByKey } from "./exam-identity";

export type BlueprintNotice = { message: string; provenance: LibraryProvenance };

export type SaveExamBlueprintInput = {
  content: BlueprintContent;
  identity: ExamIdentity;
  /** The notice or syllabus the blueprint was read from. */
  sourceId: string;
  provenance: LibraryProvenance;
  /** The line shown to learners when an existing blueprint changed. */
  notice?: BlueprintNotice | null;
};

export type SavedExamBlueprint = {
  blueprint: ExamBlueprint;
  changes: BlueprintChange[];
  created: boolean;
  /** The update moved the exam's own days (see `movesExamDays`), which learners' dates follow. */
  movesExamDays: boolean;
  /** The learner notice the update recorded; null when nothing changed or it has none. */
  noticeId: string | null;
};

const EMPTY_CONTENT: BlueprintContent = {
  edition: {
    citations: [],
    dates: [],
    noticeUrl: null,
    questionCount: null,
    sourceHash: null,
    timeZone: null,
    year: null,
  },
  structure: { formats: [], mock: null, rules: [], subjects: [] },
  topicFrequency: [],
};

/**
 * A stored blueprint in the current shape. Rows from before a shape change
 * read as empty sections, so the next reading replaces them instead of failing.
 */
export function readBlueprintContent(blueprint: ExamBlueprint): BlueprintContent {
  return {
    edition: examEditionSchema.safeParse(blueprint.edition).data ?? EMPTY_CONTENT.edition,
    structure: examStructureSchema.safeParse(blueprint.structure).data ?? EMPTY_CONTENT.structure,
    topicFrequency: topicFrequencySchema.safeParse(blueprint.topicFrequency).data ?? [],
  };
}

function findLastDate(dates: ExamDate[], kind: ExamDate["kind"]): Date | null {
  const matching = dates.filter((date) => date.kind === kind).map((date) => date.date);
  const last = matching.toSorted().at(-1);

  return last ? new Date(`${last}T00:00:00.000Z`) : null;
}

/** The columns freshness and plans query, read from the edition's cited dates. */
function toDateColumns(content: BlueprintContent) {
  const examDate = findLastDate(content.edition.dates, "exam");

  return {
    examDate,
    registrationEndsAt: findLastDate(content.edition.dates, "registrationEnd"),
    validUntil: examDate,
  };
}

function toContentColumns(content: BlueprintContent) {
  return {
    edition: content.edition,
    structure: content.structure,
    topicFrequency: content.topicFrequency,
    ...toDateColumns(content),
  };
}

/**
 * Whether a reading is of an edition whose exam days have all passed: a notice found again after
 * its exam (the next one isn't out), whose new reading tells learners preparing for the next
 * edition nothing they'd act on, so it gets no learner notice.
 */
export function isPastEdition({
  content,
  now = new Date(),
}: {
  content: BlueprintContent;
  now?: Date;
}): boolean {
  const examDate = findLastDate(content.edition.dates, "exam");
  return examDate !== null && examDate.getTime() + MS_PER_DAY <= now.getTime();
}

/**
 * What a new reading would change on the stored blueprint, so the workflow
 * can ask a model for the learner notice before saving. Null when there's
 * nothing to tell learners: the exam has no blueprint yet, or the reading is of
 * the very document the blueprint was read from (newer reading instructions
 * read it again: the exam didn't change, only how well it's read).
 */
export async function previewExamBlueprintChanges({
  content,
  identity,
}: {
  content: BlueprintContent;
  identity: ExamIdentity;
}): Promise<BlueprintChange[] | null> {
  const current = await findExamBlueprintByKey({
    identityKey: buildExamIdentityKey(identity),
    language: identity.language,
  });

  if (!current) {
    return null;
  }

  const stored = readBlueprintContent(current);
  const sourceHash = content.edition.sourceHash;

  if (sourceHash !== null && sourceHash === stored.edition.sourceHash) {
    return null;
  }

  return mergeBlueprintContent({ current: stored, next: content }).changes;
}

async function updateBlueprint({
  current,
  input,
}: {
  current: ExamBlueprint;
  input: SaveExamBlueprintInput;
}): Promise<SavedExamBlueprint> {
  const stored = readBlueprintContent(current);
  const { changes, content } = mergeBlueprintContent({ current: stored, next: input.content });

  const notice = changes.length > 0 ? input.notice : null;

  const { blueprint, noticeId } = await prisma.$transaction(async (tx) => {
    const updated = await tx.examBlueprint.update({
      data: {
        ...toContentColumns(content),
        sourceId: input.sourceId,
        ...(changes.length > 0 ? toProvenanceData(input.provenance) : {}),
      },
      where: { id: current.id },
    });

    if (!notice) {
      return { blueprint: updated, noticeId: null };
    }

    const recorded = await createSourceChangeNotice({
      data: {
        contentHash: input.content.edition.sourceHash ?? "",
        examBlueprintId: current.id,
        fields: changes.map((change) => change.field),
        language: current.language,
        message: notice.message,
        previousHash: stored.edition.sourceHash ?? "",
        sourceId: input.sourceId,
        ...toProvenanceData(notice.provenance),
      },
      replacedSourceId: current.sourceId,
      tx,
    });

    return { blueprint: updated, noticeId: recorded.id };
  });

  return {
    blueprint,
    changes,
    created: false,
    movesExamDays: movesExamDays({ current: stored, merged: content }),
    noticeId,
  };
}

/**
 * Whether the exam's stored blueprint was already read from this very notice with the current
 * reading instructions (`promptVersion`), so reading it again would only repeat that reading: a
 * new edition, a corrected notice or new instructions are read again.
 */
export async function isNoticeAlreadyRead({
  identity,
  promptVersion,
  sourceId,
}: {
  identity: ExamIdentity;
  promptVersion: string;
  sourceId: string;
}): Promise<boolean> {
  const [blueprint, source] = await Promise.all([
    findExamBlueprintByKey({
      identityKey: buildExamIdentityKey(identity),
      language: identity.language,
    }),
    prisma.source.findUnique({ select: { contentHash: true }, where: { id: sourceId } }),
  ]);

  if (!blueprint || !source) {
    return false;
  }

  const { sourceHash } = readBlueprintContent(blueprint).edition;

  return blueprint.promptVersion === promptVersion && sourceHash === source.contentHash;
}

/**
 * A notice is stored when research fetches it, before anyone has read its
 * dates, so it starts with the undated rule. Once the blueprint knows the exam
 * date, the notice stays valid until then. Uploads are never fetched again.
 */
async function keepNoticeUntilExam({
  blueprint,
  sourceId,
}: {
  blueprint: ExamBlueprint;
  sourceId: string;
}): Promise<void> {
  if (!blueprint.examDate) {
    return;
  }

  await prisma.source.updateMany({
    data: { validUntil: blueprint.examDate },
    where: { id: sourceId, kind: { not: "upload" } },
  });
}

/**
 * Stores an exam's canonical blueprint, or updates the existing one with only
 * what changed, recording the learner notice alongside. A new edition is a new
 * reading of the same exam, so lessons and items built on the blueprint carry
 * over and only changed sections are replaced.
 */
export async function saveExamBlueprint(
  input: SaveExamBlueprintInput,
): Promise<SavedExamBlueprint> {
  const identityKey = buildExamIdentityKey(input.identity);
  const { identity } = input;

  const { created, row } = await createOrFindByIdentity({
    create: () =>
      prisma.examBlueprint.create({
        data: {
          board: identity.board,
          country: identity.country,
          identityKey,
          language: identity.language,
          name: identity.name,
          role: identity.role,
          sourceId: input.sourceId,
          ...toLibraryVisibility(identity.ownerId),
          ...toContentColumns(input.content),
          ...toProvenanceData(input.provenance),
        },
      }),
    findExisting: () => findExamBlueprintByKey({ identityKey, language: identity.language }),
  });

  const saved = created
    ? { blueprint: row, changes: [], created: true, movesExamDays: false, noticeId: null }
    : await updateBlueprint({ current: row, input });

  await keepNoticeUntilExam({ blueprint: saved.blueprint, sourceId: input.sourceId });

  revalidateCacheTags([getExamBlueprintCacheTag(saved.blueprint.id)]);

  return saved;
}
