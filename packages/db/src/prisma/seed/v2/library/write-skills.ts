import { buildSkillIdentityKey } from "@zoonk/utils/identity-key";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";
import { type Prisma, type PrismaClient } from "../../../../generated/prisma/client";
import { type SeedLanguage, localizeObject } from "../_utils/localize";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { libraryIds } from "./library-ids";
import { type SeedCourse, type SeedItem, type SeedSkill } from "./types";

type CourseLanguage = { course: SeedCourse; language: SeedLanguage; prisma: PrismaClient };

/** The Library row of each of a course's skills in one language, by the skill's key. */
export type SkillIds = ReadonlyMap<string, string>;

function targetLanguageOf(course: SeedCourse): string | null {
  return course.targetLanguage ?? null;
}

function identityKeyOf(course: SeedCourse, skill: SeedSkill, language: SeedLanguage): string {
  return buildSkillIdentityKey({
    name: skill.name.in(language),
    targetLanguage: targetLanguageOf(course),
  });
}

/** The id of a course skill's Library row, from `findSkillIds`. */
export function skillIdOf(course: SeedCourse, skillIds: SkillIds, key: string): string {
  const id = skillIds.get(key);

  if (!id) {
    throw new Error(`Seed course "${course.key}" has no skill "${key}"`);
  }

  return id;
}

/**
 * Each of a course's skills in one language, by key: the Library row with its identity. Identity
 * search keeps one skill per identity, so a skill the app already wrote under the same name, on a
 * database learners have used, is the seed's skill too, under the app's id. The others are the
 * seed's own rows, under their stable ids.
 */
export async function findSkillIds({
  course,
  language,
  prisma,
}: CourseLanguage): Promise<SkillIds> {
  const skills = course.skills.map((skill) => ({
    identityKey: identityKeyOf(course, skill, language),
    key: skill.key,
  }));

  const rows = await prisma.skill.findMany({
    select: { id: true, identityKey: true },
    where: { identityKey: { in: skills.map((skill) => skill.identityKey) }, language },
  });

  const byIdentity = new Map(rows.map((row) => [row.identityKey, row.id]));

  return new Map(
    skills.map(({ identityKey, key }) => [
      key,
      byIdentity.get(identityKey) ?? libraryIds.skill(course.key, key, language),
    ]),
  );
}

async function upsertSkill({ course, language, prisma }: CourseLanguage, skill: SeedSkill) {
  const id = libraryIds.skill(course.key, skill.key, language);
  const name = skill.name.in(language);
  const targetLanguage = targetLanguageOf(course);

  const data = {
    description: skill.description.in(language),
    example: skill.example?.in(language) ?? null,
    identityKey: identityKeyOf(course, skill, language),
    language,
    level: skill.level,
    name,
    normalizedName: normalizeString(name),
    targetLanguage,
    ...SEED_PROVENANCE,
  };

  await prisma.skill.upsert({ create: { id, ...data }, update: data, where: { id } });
}

/**
 * Skills first, then the graph edges between them. A skill the app already wrote is reused as is
 * (see `findSkillIds`). Returns each skill's row, which the course's lessons and items point at.
 */
export async function writeSkills(context: CourseLanguage): Promise<SkillIds> {
  const { course, language, prisma } = context;
  const skillIds = await findSkillIds(context);

  const ownSkills = course.skills.filter(
    (skill) => skillIds.get(skill.key) === libraryIds.skill(course.key, skill.key, language),
  );

  await Promise.all(ownSkills.map((skill) => upsertSkill(context, skill)));

  const edges = course.skills.flatMap((skill) =>
    (skill.prerequisites ?? []).map((prerequisite) => ({
      prerequisiteId: skillIdOf(course, skillIds, prerequisite),
      skillId: skillIdOf(course, skillIds, skill.key),
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

  return skillIds;
}

/** Completes abbreviated seed declarations after their text is localized. */
function itemContent(item: SeedItem, language: SeedLanguage): Prisma.InputJsonObject {
  const content = localizeObject(item.content, language);

  if (item.format === "multipleChoice") {
    return { fixedOrder: false, image: null, select: 1, visual: null, ...content };
  }

  if (item.format === "trueFalse" || item.format === "typed") {
    return { image: null, visual: null, ...content };
  }

  if (item.format === "numeric") {
    return { entry: { kind: "number", places: null }, otherSolutions: [], ...content };
  }

  if (item.format === "essay" && Array.isArray(content.rubric)) {
    return {
      ...content,
      rubric: content.rubric.map((row: Prisma.InputJsonValue | null) =>
        isJsonObject(row) ? { points: null, ...row } : row,
      ),
    };
  }

  return content;
}

/** Bank questions per skill; math items keep their solution as data inside `content`. */
export async function writeItems({
  course,
  language,
  prisma,
  skillIds,
}: CourseLanguage & { skillIds: SkillIds }): Promise<void> {
  await Promise.all(
    course.items.map((item) => {
      const id = libraryIds.item(course.key, item.key, language);

      const data = {
        content: itemContent(item, language),
        difficulty: item.difficulty,
        examBlueprintId: item.exam ? libraryIds.blueprint(item.exam, language) : null,
        format: item.format,
        language,
        skillId: skillIdOf(course, skillIds, item.skill),
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
