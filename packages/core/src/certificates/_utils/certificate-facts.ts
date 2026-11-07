import { type Certificate, type Course, type User } from "@zoonk/db";
import { CEFR_BANDS } from "../../language/levels/skill-level-rules";
import {
  type CertificateFacts,
  type OwnedCertificateFacts,
  courseCertificateDetailsSchema,
} from "../certificate-contract";

const LOGICAL_DATE_LENGTH = 10;

export const CERTIFICATE_FACTS_INCLUDE = {
  course: { select: { isPublished: true, visibility: true } },
  user: { select: { isAnonymous: true, name: true } },
} as const;

export type CertificateRow = Certificate & {
  course: Pick<Course, "isPublished" | "visibility"> | null;
  user: Pick<User, "isAnonymous" | "name">;
};

/**
 * A language goal's course levels follow the CEFR. An overview, if a language course ever has
 * one, covers no range of its own.
 */
export function getCertificateCefrRange({
  courseLevel,
  targetLanguage,
}: Pick<Certificate, "courseLevel" | "targetLanguage">): string | null {
  return targetLanguage && courseLevel && courseLevel !== "overview"
    ? CEFR_BANDS[courseLevel]
    : null;
}

/** A guest has no profile to name. */
function getRecipientName(user: CertificateRow["user"]): string | null {
  return user.isAnonymous ? null : user.name.trim() || null;
}

export function toCertificateFacts(row: CertificateRow): CertificateFacts {
  const isPublicCourse = row.course?.isPublished && row.course.visibility === "public";

  return {
    ...courseCertificateDetailsSchema.parse(row.details),
    cefrRange: getCertificateCefrRange(row),
    code: row.code,
    completedOn: row.completedOn.toISOString().slice(0, LOGICAL_DATE_LENGTH),
    courseId: isPublicCourse ? row.courseId : null,
    courseLevel: row.courseLevel,
    language: row.language,
    recipientName: getRecipientName(row.user),
    title: row.title ?? "",
  };
}

export function toOwnedCertificateFacts(row: CertificateRow): OwnedCertificateFacts {
  return {
    ...toCertificateFacts(row),
    locked: row.issuedAt === null,
    shownAt: row.shownAt?.toISOString() ?? null,
  };
}
