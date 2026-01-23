import type { Organization, PrismaClient } from "../../generated/prisma/client";

type WordSeedData = {
  targetLanguage: string;
  userLanguage: string;
  word: string;
  translation: string;
  pronunciation: string;
  romanization?: string;
  audioUrl?: string;
  lessonSlugs: string[];
};

const wordsData: WordSeedData[] = [
  {
    lessonSlugs: ["greetings-introductions"],
    pronunciation: "OH-lah",
    targetLanguage: "es",
    translation: "hello",
    userLanguage: "en",
    word: "hola",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    pronunciation: "BWEH-nohs DEE-ahs",
    targetLanguage: "es",
    translation: "good morning",
    userLanguage: "en",
    word: "buenos días",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    pronunciation: "GRAH-syahs",
    targetLanguage: "es",
    translation: "thank you",
    userLanguage: "en",
    word: "gracias",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    pronunciation: "ah-DYOHS",
    targetLanguage: "es",
    translation: "goodbye",
    userLanguage: "en",
    word: "adiós",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    pronunciation: "pohr fah-BOHR",
    targetLanguage: "es",
    translation: "please",
    userLanguage: "en",
    word: "por favor",
  },
];

async function seedWord(
  prisma: PrismaClient,
  org: Organization,
  data: WordSeedData,
): Promise<void> {
  const word = await prisma.word.upsert({
    create: {
      audioUrl: data.audioUrl,
      organizationId: org.id,
      pronunciation: data.pronunciation,
      romanization: data.romanization,
      targetLanguage: data.targetLanguage,
      translation: data.translation,
      userLanguage: data.userLanguage,
      word: data.word,
    },
    update: {},
    where: {
      orgWord: {
        organizationId: org.id,
        targetLanguage: data.targetLanguage,
        userLanguage: data.userLanguage,
        word: data.word,
      },
    },
  });

  const lessonWordPromises = data.lessonSlugs.map(async (lessonSlug) => {
    const lesson = await prisma.lesson.findFirst({
      where: {
        organizationId: org.id,
        slug: lessonSlug,
      },
    });

    if (lesson) {
      await prisma.lessonWord.upsert({
        create: {
          lessonId: lesson.id,
          wordId: word.id,
        },
        update: {},
        where: {
          lessonWord: {
            lessonId: lesson.id,
            wordId: word.id,
          },
        },
      });
    }
  });

  await Promise.all(lessonWordPromises);
}

export async function seedWords(prisma: PrismaClient, org: Organization): Promise<void> {
  const wordPromises = wordsData.map((data) => seedWord(prisma, org, data));
  await Promise.all(wordPromises);
}
