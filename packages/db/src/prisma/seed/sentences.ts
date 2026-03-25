import { type Organization, type PrismaClient } from "../../generated/prisma/client";

type SentenceSeedData = {
  targetLanguage: string;
  userLanguage: string;
  sentence: string;
  translation: string;
  romanization?: string;
  lessonSlugs: string[];
};

const sentencesData: SentenceSeedData[] = [
  {
    lessonSlugs: ["greetings-introductions"],
    sentence: "¿Cómo estás?",
    targetLanguage: "es",
    translation: "How are you?",
    userLanguage: "en",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    sentence: "Me llamo María.",
    targetLanguage: "es",
    translation: "My name is María.",
    userLanguage: "en",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    sentence: "Mucho gusto.",
    targetLanguage: "es",
    translation: "Nice to meet you.",
    userLanguage: "en",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    sentence: "¿De dónde eres?",
    targetLanguage: "es",
    translation: "Where are you from?",
    userLanguage: "en",
  },
  {
    lessonSlugs: ["greetings-introductions"],
    sentence: "Hasta luego.",
    targetLanguage: "es",
    translation: "See you later.",
    userLanguage: "en",
  },
];

async function seedSentence(
  prisma: PrismaClient,
  org: Organization,
  data: SentenceSeedData,
): Promise<void> {
  const sentence = await prisma.sentence.upsert({
    create: {
      organizationId: org.id,
      romanization: data.romanization,
      sentence: data.sentence,
      targetLanguage: data.targetLanguage,
    },
    update: {},
    where: {
      orgSentence: {
        organizationId: org.id,
        sentence: data.sentence,
        targetLanguage: data.targetLanguage,
      },
    },
  });

  await prisma.sentenceTranslation.upsert({
    create: {
      sentenceId: sentence.id,
      translation: data.translation,
      userLanguage: data.userLanguage,
    },
    update: {},
    where: {
      sentenceTranslation: {
        sentenceId: sentence.id,
        userLanguage: data.userLanguage,
      },
    },
  });

  const lessonSentencePromises = data.lessonSlugs.map(async (lessonSlug) => {
    const lesson = await prisma.lesson.findFirst({
      where: {
        organizationId: org.id,
        slug: lessonSlug,
      },
    });

    if (lesson) {
      await prisma.lessonSentence.upsert({
        create: {
          lessonId: lesson.id,
          sentenceId: sentence.id,
        },
        update: {},
        where: {
          lessonSentence: {
            lessonId: lesson.id,
            sentenceId: sentence.id,
          },
        },
      });
    }
  });

  await Promise.all(lessonSentencePromises);
}

export async function seedSentences(prisma: PrismaClient, org: Organization): Promise<void> {
  const sentencePromises = sentencesData.map((data) => seedSentence(prisma, org, data));
  await Promise.all(sentencePromises);
}
