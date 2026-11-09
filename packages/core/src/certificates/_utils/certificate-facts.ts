import { type Certificate, type Course, type User } from "@zoonk/db";
import {
  CERTIFIED_LEVELS,
  type CertificateFacts,
  type CertifiedLevel,
  type OwnedCertificateFacts,
  courseCertificateDetailsSchema,
  languageLevelCertificateDetailsSchema,
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

const NO_DETAILS = {
  canDo: [],
  category: null,
  lessonsStudied: null,
  lessonsTestedOut: null,
  minutes: null,
  topics: [],
} satisfies Partial<CertificateFacts>;

/** A guest has no profile to name. */
function getRecipientName(user: CertificateRow["user"]): string | null {
  return user.isAnonymous ? null : user.name.trim() || null;
}

function toCertifiedLevel(level: string | null): CertifiedLevel | null {
  return CERTIFIED_LEVELS.find((band) => band === level) ?? null;
}

function getKindDetails(row: CertificateRow) {
  if (row.kind === "course") {
    return courseCertificateDetailsSchema.parse(row.details);
  }

  return languageLevelCertificateDetailsSchema.parse(row.details);
}

export function toCertificateFacts(row: CertificateRow): CertificateFacts {
  const isPublicCourse = row.course?.isPublished && row.course.visibility === "public";

  return {
    ...NO_DETAILS,
    ...getKindDetails(row),
    code: row.code,
    completedOn: row.completedOn.toISOString().slice(0, LOGICAL_DATE_LENGTH),
    courseId: isPublicCourse ? row.courseId : null,
    courseLevel: row.courseLevel,
    kind: row.kind,
    language: row.language,
    level: toCertifiedLevel(row.level),
    recipientName: getRecipientName(row.user),
    targetLanguage: row.targetLanguage,
    title: row.title,
  };
}

export function toOwnedCertificateFacts(row: CertificateRow): OwnedCertificateFacts {
  return {
    ...toCertificateFacts(row),
    locked: row.issuedAt === null,
    shownAt: row.shownAt?.toISOString() ?? null,
  };
}
