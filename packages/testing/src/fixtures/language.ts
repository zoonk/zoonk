import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { toUTCMidnight } from "@zoonk/utils/date";
import { normalizeString } from "@zoonk/utils/string";
import { fixtureProvenance } from "./_utils/fixture-attrs";
import { courseFixture } from "./courses";
import {
  goalFixture,
  layOutPlanFixture,
  planFixture,
  planItemFixture,
  plannedSkills,
} from "./goals";
import { courseChapterFixture, libraryChapterFixture } from "./library-chapters";
import { chapterLessonFixture, lessonSkillFixture, libraryLessonFixture } from "./library-lessons";
import { playableLessonFixture } from "./playable-lessons";
import { skillFixture, skillsFixture } from "./skills";
import { userFixture } from "./users";

export const RENTING_SCENARIO = {
  character: { name: "Linda", place: "Queen Street", role: "proprietária" },
  characterBrief: "A friendly landlord. Rent is $2,400; viewings on Saturday.",
  hints: ["Is it still available?", "Can I see it on Saturday?"],
  objectives: [
    { description: "Perguntar se está livre", label: "Is it available?" },
    { description: "Marcar uma visita", label: "Book a viewing" },
    { description: "Perguntar a caução", label: "Ask about the deposit" },
  ],
  openingLine: "Hi! Are you calling about the apartment?",
  situation: "Você liga para a proprietária de um apartamento.",
  title: "Ligar para marcar uma visita",
};

const TEST_DTLS_FINGERPRINT =
  "sha-256 6B:8B:F0:65:5F:78:E2:51:3B:AC:6F:F3:3F:46:1B:35:DC:B8:5F:64:1A:24:C2:43:F0:A1:58:D0:A1:2C:19:08";

export const LIVE_CALL_SDP_OFFER = [
  "v=0",
  "o=- 4611731400430051336 2 IN IP4 127.0.0.1",
  "s=-",
  "t=0 0",
  "a=group:BUNDLE 0 1",
  "a=msid-semantic: WMS",
  "m=audio 9 UDP/TLS/RTP/SAVPF 111",
  "c=IN IP4 0.0.0.0",
  "a=ice-ufrag:Zk3e",
  "a=ice-pwd:asd88fgpdd777uzjYhagZg7a",
  `a=fingerprint:${TEST_DTLS_FINGERPRINT}`,
  "a=setup:actpass",
  "a=mid:0",
  "a=sendrecv",
  "a=rtcp-mux",
  "a=rtpmap:111 opus/48000/2",
  "m=application 9 UDP/DTLS/SCTP webrtc-datachannel",
  "c=IN IP4 0.0.0.0",
  "a=ice-ufrag:Zk3e",
  "a=ice-pwd:asd88fgpdd777uzjYhagZg7a",
  `a=fingerprint:${TEST_DTLS_FINGERPRINT}`,
  "a=setup:actpass",
  "a=mid:1",
  "a=sctp-port:5000",
  "",
].join("\r\n");

function unitOf(index: number) {
  return index < 2 ? 0 : 1;
}

export async function languageGoalFixture({ userId }: { userId?: string } = {}) {
  const [user, course] = await Promise.all([
    userId ? prisma.user.findUniqueOrThrow({ where: { id: userId } }) : userFixture(),
    courseFixture({ language: "pt" }),
  ]);

  const [arriving, renting] = await Promise.all(
    ["Chegando", "Alugando um apartamento"].map((title, index) =>
      libraryChapterFixture({
        language: "pt",
        objectives: [`Consigo fazer a parte ${index + 1}`],
        targetLanguage: "en",
        title,
      }),
    ),
  );

  if (!arriving || !renting) {
    throw new Error("Units weren't created");
  }

  await Promise.all([
    courseChapterFixture({ chapterId: arriving.id, courseId: course.id, position: 0 }),
    courseChapterFixture({ chapterId: renting.id, courseId: course.id, position: 1 }),
  ]);

  const lessons = await Promise.all(
    [arriving, arriving, renting, renting].map((chapter, index) =>
      libraryLessonFixture({
        homeChapterId: chapter.id,
        language: "pt",
        targetLanguage: "en",
        title: `Lição ${index + 1}`,
      }),
    ),
  );

  const skills = await skillsFixture(
    lessons.map((lesson) => `${lesson.title} ${randomUUID()}`),
    { language: "pt" },
  );

  await Promise.all(
    lessons.flatMap((lesson, index) => [
      chapterLessonFixture({
        chapterId: index < 2 ? arriving.id : renting.id,
        lessonId: lesson.id,
        position: index % 2,
      }),
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ]),
  );

  const goal = await goalFixture({
    details: { level: "A2", reason: "Mudança para Toronto", targetLevel: "B1+" },
    kind: "language",
    language: "pt",
    primaryCourseId: course.id,
    targetLanguage: "en",
    title: "Inglês para Toronto",
    userId: user.id,
  });

  const plan = await planFixture({
    goalId: goal.id,
    graph: {
      skills: plannedSkills(skills.map((skill, index) => ({ ...skill, phase: unitOf(index) }))),
    },
    phases: [{ name: arriving.title }, { name: renting.title }],
  });

  const items = await Promise.all(
    lessons.map((lesson, index) =>
      planItemFixture({
        chapterId: lesson.homeChapterId,
        lessonId: lesson.id,
        phase: unitOf(index),
        planId: plan.id,
        position: index,
        skillId: skills[index]?.id ?? null,
      }),
    ),
  );

  const laidOut = await layOutPlanFixture(plan.id);

  await prisma.conversationScenario.create({
    data: {
      chapterId: renting.id,
      content: RENTING_SCENARIO,
      level: "A2",
      model: "test",
      promptVersion: "test",
      runId: "test",
    },
  });

  return {
    arriving,
    checkpoints: laidOut.bosses,
    course,
    goal,
    items,
    lessons,
    plan: laidOut.plan,
    renting,
    skills,
    user,
  };
}

export async function reachLanguageCheckpointFixture({
  checkpoints,
  goal,
  nextLessonTodo = false,
  plan,
}: Pick<Awaited<ReturnType<typeof languageGoalFixture>>, "checkpoints" | "goal" | "plan"> & {
  nextLessonTodo?: boolean;
}) {
  const checkpoint = checkpoints[1];

  if (!checkpoint) {
    throw new Error("Expected the renting unit's checkpoint");
  }

  const [skill, next] = await Promise.all([
    skillFixture({ language: "pt", name: `Next unit ${randomUUID()}` }),
    playableLessonFixture({ lesson: { title: "The next unit's lesson" }, steps: ["check"] }),
  ]);

  const phases = Array.isArray(plan.phases) ? plan.phases : [];

  await Promise.all([
    lessonSkillFixture({ lessonId: next.lesson.id, skillId: skill.id }),
    prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } }),
    prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { not: checkpoint.id }, planId: plan.id },
    }),
    prisma.planItem.update({
      data: { scheduledFor: toUTCMidnight(new Date()) },
      where: { id: checkpoint.id },
    }),
    prisma.plan.update({
      data: { phases: [...phases, { name: "The next unit" }] },
      where: { id: plan.id },
    }),
  ]);

  const nextItem = await planItemFixture({
    kind: "lesson",
    lessonId: next.lesson.id,
    phase: 2,
    planId: plan.id,
    position: 11,
    skillId: skill.id,
    status: nextLessonTodo ? "todo" : "done",
    titleSnapshot: next.lesson.title,
  });

  await layOutPlanFixture(plan.id);
  return { checkpoint, nextItem, nextLesson: next.lesson };
}

const FIRST_LETTERS: Record<
  "ja" | "ko" | "ru",
  { letters: [symbol: string, readingAid: string][]; script: string }
> = {
  ja: {
    letters: [
      ["あ", "a"],
      ["か", "ka"],
    ],
    script: "hiragana",
  },
  ko: {
    letters: [
      ["ㅏ", "a"],
      ["ㄴ", "n"],
    ],
    script: "hangul",
  },
  ru: {
    letters: [
      ["Д", "d"],
      ["Ж", "zh"],
    ],
    script: "cirílico",
  },
};

/** Pass core's `getAlphabetIdentityKey` for the script; concurrent calls get one lesson. */
export async function alphabetLessonFixture({
  identityKey,
  targetLanguage,
}: {
  identityKey: string;
  targetLanguage: keyof typeof FIRST_LETTERS;
}) {
  const { letters, script } = FIRST_LETTERS[targetLanguage];
  const title = `Seu primeiro ${script}`;

  const lesson = await prisma.lesson.upsert({
    create: {
      canDo: `Ler e dizer as primeiras letras do ${script}`,
      contentStatus: "completed",
      description: `As primeiras letras do ${script}.`,
      estimatedMinutes: 5,
      identityKey,
      language: "pt",
      level: "beginner",
      normalizedTitle: normalizeString(title),
      slug: `alphabet-${targetLanguage}-${randomUUID()}`,
      targetLanguage,
      title,
      ...fixtureProvenance(),
    },
    update: {},
    where: { languageIdentity: { identityKey, language: "pt" } },
  });

  const steps = [
    {
      content: { text: `Cada letra do ${script} tem um som.`, title: "Um som por letra" },
      kind: "explanation" as const,
    },
    ...letters.map(([symbol, readingAid], index) => ({
      content: {
        audioText: symbol,
        audioUrl:
          index === 0 ? `https://audio.zoonk.test/${targetLanguage}-${readingAid}.mp3` : null,
        forms: [],
        pronunciation: `Como o ${readingAid} de casa.`,
        readingAid,
        symbol,
      },
      kind: "alphabet" as const,
    })),
    {
      content: {
        pairs: letters.map(([symbol, readingAid]) => ({ left: symbol, right: readingAid })),
      },
      kind: "matchColumns" as const,
    },
    {
      content: { ideas: [{ text: `Você já lê ${letters.length} letras.` }] },
      kind: "summary" as const,
    },
  ];

  await prisma.step.createMany({
    data: steps.map((step, position) => ({
      ...step,
      ...fixtureProvenance(),
      lessonId: lesson.id,
      position,
    })),
    skipDuplicates: true,
  });

  return lesson;
}
