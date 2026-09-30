import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
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
import { type BlueprintChange, mergeBlueprintContent } from "./blueprint-diff";
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
 * What a new reading would change on the stored blueprint, so the workflow
 * can ask a model for the learner notice before saving. Null when the exam has
 * no blueprint yet.
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

  return mergeBlueprintContent({ current: readBlueprintContent(current), next: content }).changes;
}

async function updateBlueprint({
  current,
  input,
}: {
  current: ExamBlueprint;
  input: SaveExamBlueprintInput;
}): Promise<SavedExamBlueprint> {
  const { changes, content } = mergeBlueprintContent({
    current: readBlueprintContent(current),
    next: input.content,
  });

  const notice = changes.length > 0 ? input.notice : null;

  const blueprint = await prisma.$transaction(async (tx) => {
    const updated = await tx.examBlueprint.update({
      data: {
        ...toContentColumns(content),
        sourceId: input.sourceId,
        ...(changes.length > 0 ? toProvenanceData(input.provenance) : {}),
      },
      where: { id: current.id },
    });

    if (notice) {
      await createSourceChangeNotice({
        data: {
          contentHash: input.content.edition.sourceHash ?? "",
          examBlueprintId: current.id,
          fields: changes.map((change) => change.field),
          language: current.language,
          message: notice.message,
          previousHash: readBlueprintContent(current).edition.sourceHash ?? "",
          sourceId: input.sourceId,
          ...toProvenanceData(notice.provenance),
        },
        replacedSourceId: current.sourceId,
        tx,
      });
    }

    return updated;
  });

  return { blueprint, changes, created: false };
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
    ? { blueprint: row, changes: [], created: true }
    : await updateBlueprint({ current: row, input });

  await keepNoticeUntilExam({ blueprint: saved.blueprint, sourceId: input.sourceId });

  revalidateCacheTags([getExamBlueprintCacheTag(saved.blueprint.id)]);

  return saved;
}
