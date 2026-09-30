import { buildSkillIdentityKey } from "@zoonk/utils/identity-key";
import { normalizeString } from "@zoonk/utils/string";
import { type PrismaClient } from "../../../../generated/prisma/client";
import { type SeedLanguage, localizeObject } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { libraryIds } from "./library-ids";
import { type SeedCourse, type SeedSkill } from "./types";

type CourseLanguage = { course: SeedCourse; language: SeedLanguage; prisma: PrismaClient };

function targetLanguageOf(course: SeedCourse): string | null {
  return course.targetLanguage ?? null;
}

async function upsertSkill({ course, language, prisma }: CourseLanguage, skill: SeedSkill) {
  const id = libraryIds.skill(course.key, skill.key, language);
  const name = skill.name.in(language);
  const targetLanguage = targetLanguageOf(course);

  const data = {
    description: skill.description.in(language),
    example: skill.example?.in(language) ?? null,
    identityKey: buildSkillIdentityKey({ name, targetLanguage }),
    language,
    level: skill.level,
    name,
    normalizedName: normalizeString(name),
    targetLanguage,
    ...SEED_PROVENANCE,
  };

  await prisma.skill.upsert({ create: { id, ...data }, update: data, where: { id } });
}

/** Skills first, then the graph edges between them. */
export async function writeSkills(context: CourseLanguage): Promise<void> {
  const { course, language, prisma } = context;

  await Promise.all(course.skills.map((skill) => upsertSkill(context, skill)));

  const edges = course.skills.flatMap((skill) =>
    (skill.prerequisites ?? []).map((prerequisite) => ({
      prerequisiteId: libraryIds.skill(course.key, prerequisite, language),
      skillId: libraryIds.skill(course.key, skill.key, language),
    })),
  );

  await Promise.all(
    edges.map((edge) =>
      prisma.skillPrerequisite.upsert({
        create: edge,
        update: {},
        where: { skillId_prerequisiteId: edge },
      }),
    ),
  );
}

/** Bank questions per skill; math items keep their solution as data inside `content`. */
export async function writeItems({ course, language, prisma }: CourseLanguage): Promise<void> {
  await Promise.all(
    course.items.map((item) => {
      const id = libraryIds.item(course.key, item.key, language);

      const data = {
        content: localizeObject(item.content, language),
        difficulty: item.difficulty,
        examBlueprintId: item.exam ? libraryIds.blueprint(item.exam, language) : null,
        format: item.format,
        language,
        skillId: libraryIds.skill(course.key, item.skill, language),
        ...SEED_PROVENANCE,
      };

      return prisma.item.upsert({ create: { id, ...data }, update: data, where: { id } });
    }),
  );
}

/**
 * Words and sentences are shared per target language, so an existing row is reused as is and
 * only the pronunciation guide for this learner language is added when missing.
 */
export async function writeVocabulary({
  course,
  language,
  organizationId,
  prisma,
}: CourseLanguage & { organizationId: string }) {
  const targetLanguage = course.targetLanguage ?? language;

  const words = await Promise.all(
    (course.words ?? []).map(async (entry) => {
      const word = await prisma.word.upsert({
        create: { organizationId, targetLanguage, word: entry.text },
        update: {},
        where: { orgWord: { organizationId, targetLanguage, word: entry.text } },
      });

      if (entry.pronunciation) {
        await prisma.wordPronunciation.upsert({
          create: {
            pronunciation: entry.pronunciation.in(language),
            tip: entry.tip?.in(language) ?? null,
            userLanguage: language,
            wordId: word.id,
          },
          update: {},
          where: { wordPronunciation: { userLanguage: language, wordId: word.id } },
        });

        // A shared pronunciation written elsewhere keeps its text; only a missing tip is added.
        if (entry.tip) {
          await prisma.wordPronunciation.updateMany({
            data: { tip: entry.tip.in(language) },
            where: { tip: null, userLanguage: language, wordId: word.id },
          });
        }
      }

      return [entry.text, word.id] as const;
    }),
  );

  const sentences = await Promise.all(
    (course.sentences ?? []).map(async (entry) => {
      const sentence = await prisma.sentence.upsert({
        create: { organizationId, sentence: entry.text, targetLanguage },
        update: {},
        where: { orgSentence: { organizationId, sentence: entry.text, targetLanguage } },
      });

      return [entry.text, sentence.id] as const;
    }),
  );

  return { sentenceIds: new Map(sentences), wordIds: new Map(words) };
}
