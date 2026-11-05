import { CertificateKind, CourseLevel, LanguageSkill } from "@zoonk/db/enums";
import { COURSE_CATEGORIES } from "@zoonk/utils/categories";
import { z } from "zod";

/** C2 has nothing above it to reach, and the level test tops out at C1+. */
export const CERTIFIED_LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;

export type CertifiedLevel = (typeof CERTIFIED_LEVELS)[number];

/** Crockford base32: no I, L, O or U, so a code typed from paper reads one way. */
export const CERTIFICATE_CODE_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const CERTIFICATE_CODE_LENGTH = 12;

const CERTIFICATE_CODE = new RegExp(
  `^[${CERTIFICATE_CODE_ALPHABET}]{${CERTIFICATE_CODE_LENGTH}}$`,
  "u",
);

/** Reads a code as people type it: any case, with dashes or spaces, I or L for 1 and O for 0. */
export function normalizeCertificateCode(input: string): string | null {
  const code = input
    .toUpperCase()
    .replaceAll(/[\s-]/gu, "")
    .replaceAll(/[IL]/gu, "1")
    .replaceAll("O", "0");

  return CERTIFICATE_CODE.test(code) ? code : null;
}

const countSchema = z.int().min(0);

const certifiedLevelSchema = z.enum(CERTIFIED_LEVELS);

const skillLevelSchema = z
  .object({
    label: z.string().meta({ description: 'The skill\'s level, such as "B1" or "B2+"' }),
    skill: z.enum(LanguageSkill),
  })
  .meta({ id: "CertificateSkillLevel" });

export const courseCertificateDetailsSchema = z.object({
  category: z.enum(COURSE_CATEGORIES).nullable(),
  lessonsStudied: countSchema,
  lessonsTestedOut: countSchema,
  minutes: countSchema.nullable(),
  topics: z.array(z.string()),
});

export const languageLevelCertificateDetailsSchema = z.object({
  canDo: z.array(z.string()),
  lessonsStudied: countSchema,
  minutes: countSchema.nullable(),
  skillLevels: z.array(skillLevelSchema),
});

export type CourseCertificateDetails = z.infer<typeof courseCertificateDetailsSchema>;

export type LanguageLevelCertificateDetails = z.infer<typeof languageLevelCertificateDetailsSchema>;

/** A plain shape, so the API can add its links without an `allOf` strict clients can't decode. */
export const certificateFactsShape = {
  canDo: z
    .array(z.string())
    .meta({ description: "Language level: what the learner can do, in the certificate's words" }),
  category: z
    .enum(COURSE_CATEGORIES)
    .nullable()
    .meta({ description: "Course: the course's first category, for its subject mark" }),
  code: z
    .string()
    .meta({
      description:
        'The public verification code, 12 characters; show it in groups of four ("K7QF-2M9X-HD4P")',
    }),
  completedOn: z.iso.date().meta({ description: "The learner-local day it was earned" }),
  courseId: z
    .uuid()
    .nullable()
    .meta({ description: "Course: the course while it's public, for a link to its page" }),
  courseLevel: z
    .enum(CourseLevel)
    .nullable()
    .meta({
      description:
        'Course: the level it certifies, named with the title ("Python · Beginner"). Null for a plan certified whole, and for language levels',
    }),
  kind: z.enum(CertificateKind),
  language: z.string().meta({ description: "The locale the certificate's own words are in" }),
  lessonsStudied: countSchema.nullable().meta({ description: "Course and language level" }),
  lessonsTestedOut: countSchema.nullable().meta({ description: "Course: lessons passed by test" }),
  level: certifiedLevelSchema
    .nullable()
    .meta({ description: "Language level: the level finished" }),
  minutes: countSchema
    .nullable()
    .meta({
      description:
        "Course and language level: about how long the studied lessons take, from the plan's estimates; null when unknown",
    }),
  recipientName: z
    .string()
    .nullable()
    .meta({
      description:
        "The learner's profile name, read live, so fixing it fixes every certificate; null when empty: ask for a name before they share, print or download",
    }),
  skillLevels: z
    .array(skillLevelSchema)
    .meta({
      description:
        "Language level: each skill the learner's answers raised, at its level when earned",
    }),
  targetLanguage: z.string().nullable().meta({ description: "Language kinds: the language" }),
  title: z
    .string()
    .nullable()
    .meta({
      description:
        "Course: its title, as written. Null for language kinds, named from the language",
    }),
  topics: z
    .array(z.string())
    .meta({
      description:
        "Course: the chapters it covers in plan order, the level's for a level and every one for a plan",
    }),
};

export const certificateFactsSchema = z
  .object(certificateFactsShape)
  .meta({
    description:
      "What a certificate certifies, as anyone may see it: nothing else about the learner leaves.",
    id: "CertificateFacts",
  });

export type CertificateFacts = z.infer<typeof certificateFactsSchema>;

export const ownedCertificateShape = {
  ...certificateFactsShape,
  shownAt: z.iso
    .datetime()
    .nullable()
    .meta({
      description:
        "When its award moment was closed (POST /me/certificates/{code}/views); null until then",
    }),
};

export type OwnedCertificateFacts = CertificateFacts & { shownAt: string | null };

export const unshownCertificatesSchema = z
  .array(certificateFactsSchema)
  .meta({
    description:
      "The learner's certificates whose award moment wasn't closed yet, oldest first; usually empty. Show them before any milestone `ceremony`, then POST /me/certificates/{code}/views for each. Images and links: GET /certificates/{code}",
  });
