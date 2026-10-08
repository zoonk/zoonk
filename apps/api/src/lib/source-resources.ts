import { type getExamBlueprint } from "@zoonk/core/library/exams/get";
import { reusePolicySchema } from "@zoonk/core/library/sources/contract";
import { type Source, type SourceChangeNotice } from "@zoonk/db";

type SourceRow = Pick<
  Source,
  | "fetchedAt"
  | "id"
  | "kind"
  | "language"
  | "mimeType"
  | "publisher"
  | "reusePolicy"
  | "title"
  | "url"
  | "validUntil"
  | "visibility"
>;

type ExamBlueprintView = NonNullable<Awaited<ReturnType<typeof getExamBlueprint>>>;

/** Stored JSON may predate the policy shape; such a policy reads as none. */
function toReusePolicy(value: unknown) {
  return reusePolicySchema.safeParse(value).data ?? null;
}

/**
 * The public shape of a source. Storage details (its blob, identity key,
 * hash and owner) stay on the server.
 */
export function toSourceResource(source: SourceRow) {
  return {
    fetchedAt: source.fetchedAt.toISOString(),
    id: source.id,
    kind: source.kind,
    language: source.language,
    mimeType: source.mimeType,
    publisher: source.publisher,
    reusePolicy: toReusePolicy(source.reusePolicy),
    title: source.title,
    url: source.url,
    validUntil: source.validUntil?.toISOString() ?? null,
    visibility: source.visibility,
  };
}

export function toChangeNoticeResource(notice: SourceChangeNotice) {
  return {
    createdAt: notice.createdAt.toISOString(),
    examBlueprintId: notice.examBlueprintId,
    fields: notice.fields,
    id: notice.id,
    message: notice.message,
    sourceId: notice.sourceId,
  };
}

export function toExamBlueprintResource(blueprint: ExamBlueprintView) {
  return {
    board: blueprint.board,
    country: blueprint.country,
    edition: blueprint.edition,
    examDate: blueprint.examDate?.toISOString() ?? null,
    id: blueprint.id,
    language: blueprint.language,
    name: blueprint.name,
    registrationEndsAt: blueprint.registrationEndsAt?.toISOString() ?? null,
    role: blueprint.role,
    source: blueprint.source
      ? {
          fetchedAt: blueprint.source.fetchedAt.toISOString(),
          id: blueprint.source.id,
          kind: blueprint.source.kind,
          publisher: blueprint.source.publisher,
          reusePolicy: toReusePolicy(blueprint.source.reusePolicy),
          title: blueprint.source.title,
          url: blueprint.source.url,
        }
      : null,
    structure: blueprint.structure,
    topicFrequency: blueprint.topicFrequency,
    updatedAt: blueprint.updatedAt.toISOString(),
  };
}
