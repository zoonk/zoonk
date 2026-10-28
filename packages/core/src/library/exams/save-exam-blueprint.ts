import "server-only";
import { type ExamBlueprint, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getExamBlueprintCacheTag } from "../../cache/tags";
import { resolvePlanInputDependents } from "../../plans/_utils/plan-input-dependencies";
import {
  type LibraryProvenance,
  createOrFindByIdentity,
  toLibraryVisibility,
  toProvenanceData,
} from "../_utils/library-rows";
import { lockPlanInputWrite, writePlanInputs } from "../_utils/plan-input-write";
import { createSourceChangeNotice } from "../sources/content-review-flags";
import {
  type BlueprintContent,
  type ExamDate,
  type ReadingProblem,
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
  sourceId: string;
  provenance: LibraryProvenance;
  notice?: BlueprintNotice | null;
};

export type NoticeReading = { problems: ReadingProblem[]; read: boolean };

const UNREAD: NoticeReading = { problems: [], read: false };

export type SavedExamBlueprint = {
  blueprint: ExamBlueprint;
  changes: BlueprintChange[];
  created: boolean;
  movesExamDays: boolean;
  noticeId: string | null;
};

const EMPTY_CONTENT: BlueprintContent = {
  edition: {
    check: null,
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

export function isPastEdition({ content }: { content: BlueprintContent }): boolean {
  const examDate = findLastDate(content.edition.dates, "exam");
  return examDate !== null && examDate.getTime() + MS_PER_DAY <= Date.now();
}

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

  const { blueprint, noticeId } = await writePlanInputs(async (tx) => {
    await lockPlanInputWrite({
      loadPlanIds: () => resolvePlanInputDependents(tx, { blueprintIds: [current.id] }),
      lockSources: async () => {
        await tx.$queryRaw`SELECT id FROM exam_blueprints WHERE id = ${current.id}::uuid FOR UPDATE`;
      },
      tx,
    });

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

export async function findNoticeReading({
  identity,
  sourceId,
}: {
  identity: ExamIdentity;
  sourceId: string;
}): Promise<NoticeReading> {
  const [blueprint, source] = await Promise.all([
    findExamBlueprintByKey({
      identityKey: buildExamIdentityKey(identity),
      language: identity.language,
    }),
    prisma.source.findUnique({ select: { contentHash: true }, where: { id: sourceId } }),
  ]);

  const edition = blueprint ? examEditionSchema.safeParse(blueprint.edition).data : undefined;

  if (!edition || !source || edition.sourceHash !== source.contentHash) {
    return UNREAD;
  }

  return { problems: edition.check?.problems ?? [], read: true };
}

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
