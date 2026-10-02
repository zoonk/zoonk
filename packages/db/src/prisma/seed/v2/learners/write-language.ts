import { daysFrom } from "../_utils/dates";
import { SEED_PROVENANCE } from "../_utils/provenance";
import { seedId } from "../_utils/seed-id";
import { type LearnerScope } from "./write-goal";

const MS_PER_MINUTE = 60_000;

type LanguageScope = LearnerScope & { goalId: string; language: string };

async function writeLevels({ language, learner, prisma, userId }: LanguageScope) {
  const levels = learner.languageHistory?.levels ?? [];

  await Promise.all(
    levels.map((level) => {
      const data = { score: level.score, startScore: level.start };

      return prisma.languageSkillLevel.upsert({
        create: { ...data, language, skill: level.skill, userId },
        update: data,
        where: { userLanguageSkill: { language, skill: level.skill, userId } },
      });
    }),
  );
}

async function writeWords({ language, learner, now, prisma, userId }: LanguageScope) {
  const words = learner.languageHistory?.words ?? [];

  await Promise.all(
    words.map((word) => {
      const wordId = seedId(`word:${language}:${word.text}`);
      const data = { language, learnedAt: daysFrom(now, word.day), text: word.text };

      return prisma.learnerWord.upsert({
        create: { ...data, userId, wordId },
        update: data,
        where: { userWord: { userId, wordId } },
      });
    }),
  );
}

async function writeScenarios({ learner, lookup, prisma }: LanguageScope) {
  const scenarios = learner.languageHistory?.scenarios ?? [];

  await Promise.all(
    scenarios.map((scenario) => {
      const chapterId = lookup.chapter(scenario.chapter).id;
      const data = { content: scenario.content, ...SEED_PROVENANCE };

      return prisma.conversationScenario.upsert({
        create: { ...data, chapterId, level: scenario.level },
        update: data,
        where: { chapterLevel: { chapterId, level: scenario.level } },
      });
    }),
  );
}

/** Calls held before today: finished, with the feedback a model would have written. */
async function writeConversations(scope: LanguageScope) {
  const { goalId, language, learner, lookup, now, prisma, userId } = scope;
  const history = learner.languageHistory;

  await Promise.all(
    (history?.conversations ?? []).map((call, index) => {
      const id = seedId(`learner:${learner.key}:conversation:${index}`);
      const chapter = lookup.chapter(call.chapter);

      const scenario = history?.scenarios.find(
        (item) => item.chapter === call.chapter && item.level === call.level,
      );

      const endedAt = daysFrom(now, call.day);

      const data = {
        chapterId: chapter.id,
        endedAt,
        feedback: call.feedback,
        goalId,
        kind: call.kind,
        language: learner.language,
        level: call.level,
        minutes: call.minutes,
        objectivesMet: call.objectivesMet,
        scenario: scenario?.content ?? {},
        spokenSeconds: call.spokenSeconds,
        startedAt: new Date(endedAt.getTime() - call.minutes * MS_PER_MINUTE),
        status: "completed" as const,
        targetLanguage: language,
        titleSnapshot: chapter.title,
        userId,
        ...SEED_PROVENANCE,
        generatedAt: endedAt,
      };

      return prisma.languageConversation.upsert({
        create: { id, ...data },
        update: data,
        where: { id },
      });
    }),
  );
}

async function writePattern({ goalId, language, learner, now, prisma, userId }: LanguageScope) {
  const pattern = learner.languageHistory?.pattern;

  if (!pattern) {
    return;
  }

  const id = seedId(`learner:${learner.key}:pattern`);

  const data = {
    content: pattern.content,
    createdAt: daysFrom(now, pattern.day),
    goalId,
    kind: "pattern" as const,
    language,
    mistakeIds: pattern.mistakes.map((key) => seedId(`learner:${learner.key}:mistake:${key}`)),
    practicedAt: null,
    title: pattern.title,
    userId,
    ...SEED_PROVENANCE,
  };

  await prisma.mistakePattern.upsert({ create: { id, ...data }, update: data, where: { id } });
}

/**
 * A language learner's history beyond answers: levels per skill against the level test, words
 * learned, unit calls with their feedback, the units' call scenarios (so tests and screenshots never
 * wait for a model) and a pattern noticed in recent mistakes.
 */
export async function writeLanguageHistory(scope: LearnerScope & { goalId: string }) {
  const language = scope.learner.goal.course.targetLanguage;

  if (!scope.learner.languageHistory || !language) {
    return;
  }

  const languageScope = { ...scope, language };

  await Promise.all([
    writeLevels(languageScope),
    writeWords(languageScope),
    writeScenarios(languageScope),
    writePattern(languageScope),
  ]);

  await writeConversations(languageScope);
}
